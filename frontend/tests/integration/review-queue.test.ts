import { beforeEach, describe, expect, it, vi } from "vitest";

import { startQuizSession, submitQuizAnswer } from "@/app/(features)/learn/_api/mutations";

// DB に永続化された question を保持するフェイクストア
const questionStore = new Map<string, Record<string, unknown>>();
// update時に returning() で返す review_queue レコードを制御するフラグ
let reviewQueueReturnRows: unknown[] = [];

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: { DB: {} } }),
}));

const mockDb = {
  insert: () => ({
    values: (data: unknown) => {
      const rows = Array.isArray(data) ? data : [data];
      for (const row of rows as Record<string, unknown>[]) {
        if (typeof row.questionId === "string") {
          questionStore.set(row.questionId as string, row);
        }
      }
      const p = Promise.resolve() as Promise<unknown> & {
        onConflictDoUpdate: () => Promise<unknown[]>;
      };
      p.onConflictDoUpdate = () => Promise.resolve([]);
      return p;
    },
  }),
  update: () => ({
    set: () => ({
      where: () => ({
        returning: () => Promise.resolve(reviewQueueReturnRows),
      }),
    }),
  }),
  select: () => ({
    from: () => ({
      innerJoin: () => ({
        where: () => ({
          limit: () => Promise.resolve([...questionStore.values()].slice(0, 1)),
        }),
      }),
      where: () => ({
        limit: () => Promise.resolve([...questionStore.values()].slice(0, 1)),
      }),
    }),
  }),
};

vi.mock("@/db/client", () => ({
  createDb: () => mockDb,
  getOptionalDb: () => mockDb,
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: () => ({ userId: "test-user-id" }),
}));

vi.mock("@/lib/openaiClient", () => ({
  OPENAI_MAX_OUTPUT_TOKENS: 10,
  OPENAI_TIMEOUT_MS: 1000,
  createOpenAIParsedText: vi.fn(
    async (_input: string, _model: string, _schema: unknown, schemaName: string) => {
      if (schemaName === "quiz_items_ja") {
        return {
          items: [
            {
              prompt: "次の英文の意味として最も適切なものを選んでください。\n原文: Some content.",
              choices: ["ダミー1", "ダミー2", "ダミー3", "ダミー4"],
              correctIndex: 0,
              explanation: "ダミー解説",
            },
          ],
        };
      }
      return {};
    },
  ),
}));

describe("review queue", () => {
  beforeEach(() => {
    questionStore.clear();
    reviewQueueReturnRows = [];
  });

  describe("submitQuizAnswer", () => {
    it("不正解時に isReviewRegistered: true を返す", async () => {
      const session = await startQuizSession({
        topic: "React Hooks",
        mode: "word",
        userId: "test-user-id",
      });
      const first = session.questions[0]!;

      // correctIndex = 0 なので selectedIndex = 1 は不正解
      const result = await submitQuizAnswer({
        sessionId: session.sessionId,
        questionId: first.questionId,
        selectedIndex: 1,
        userId: "test-user-id",
      });

      expect(result.isCorrect).toBe(false);
      expect(result.isReviewRegistered).toBe(true);
      expect(result.reviewNextAt).toBeUndefined();
    });

    it("正解時かつ review_queue エントリがある場合 reviewNextAt を返す", async () => {
      const session = await startQuizSession({
        topic: "React Hooks",
        mode: "word",
        userId: "test-user-id",
      });
      const first = session.questions[0]!;

      // update().returning() が review_queue エントリを返すよう設定
      reviewQueueReturnRows = [{ id: "review-id" }];

      // correctIndex = 0 なので selectedIndex = 0 は正解
      const result = await submitQuizAnswer({
        sessionId: session.sessionId,
        questionId: first.questionId,
        selectedIndex: 0,
        userId: "test-user-id",
      });

      expect(result.isCorrect).toBe(true);
      expect(result.isReviewRegistered).toBeUndefined();
      expect(typeof result.reviewNextAt).toBe("number");
      // 30日後付近であることを確認（前後1分の余裕）
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      expect(result.reviewNextAt).toBeGreaterThan(Date.now() + thirtyDaysMs - 60_000);
    });

    it("正解時かつ review_queue エントリがない場合 reviewNextAt は undefined", async () => {
      const session = await startQuizSession({
        topic: "React Hooks",
        mode: "word",
        userId: "test-user-id",
      });
      const first = session.questions[0]!;

      // reviewQueueReturnRows = [] (デフォルト) → エントリなし
      const result = await submitQuizAnswer({
        sessionId: session.sessionId,
        questionId: first.questionId,
        selectedIndex: 0,
        userId: "test-user-id",
      });

      expect(result.isCorrect).toBe(true);
      expect(result.reviewNextAt).toBeUndefined();
    });
  });

  describe("startQuizSession with reviewQuestionCount", () => {
    it("reviewQuestionCount > 0 のとき due 問題を先頭に埋め込む", async () => {
      // questionStore に due 問題（review_queue の innerJoin 結果）を事前投入
      const dueQuestionId = "due-question-id";
      questionStore.set(dueQuestionId, {
        questionId: dueQuestionId,
        sessionId: "old-session",
        prompt: "復習問題のプロンプト（先頭に来るはず）",
        choicesJson: JSON.stringify(["A", "B", "C", "D"]),
        correctIndex: 2,
        explanation: "復習解説",
        sourceQuestionId: null,
      });

      const session = await startQuizSession({
        topic: "React Hooks",
        mode: "word",
        questionCount: 3,
        reviewQuestionCount: 1,
        userId: "test-user-id",
      });

      // 先頭問題が復習問題のプロンプトであること
      expect(session.questions[0]?.prompt).toBe("復習問題のプロンプト（先頭に来るはず）");
      // 合計問題数は questionCount と一致
      expect(session.questions.length).toBe(session.actualCount);
    });
  });
});
