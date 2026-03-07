import { beforeEach, describe, expect, it, vi } from "vitest";

import { startQuizSession } from "@/server/quiz/session";
import { submitQuizAnswer } from "@/server/quiz/answer";

// DB に永続化されたレコードを保持するフェイクストア
const questionStore = new Map<string, Record<string, unknown>>();
const sessionStore = new Map<string, Record<string, unknown>>();
// update時に returning() で返す review_queue レコードを制御するフラグ
let reviewQueueReturnRows: unknown[] = [];
const insertRowsHistory: Array<Array<Record<string, unknown>>> = [];
let reviewQueueUpsertConfig: Record<string, unknown> | null = null;
let reviewQueueUpdateSetPayload: Record<string, unknown> | null = null;

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: { DB: {} } }),
}));

const mockDb = {
  insert: () => ({
    values: (data: unknown) => {
      const rows = Array.isArray(data) ? data : [data];
      insertRowsHistory.push(rows as Record<string, unknown>[]);
      for (const row of rows as Record<string, unknown>[]) {
        if (typeof row.questionId === "string" && typeof row.prompt === "string") {
          questionStore.set(row.questionId as string, row);
        }
        if (typeof row.questionIdsJson === "string") {
          sessionStore.set(row.sessionId as string, row);
        }
      }
      const p = Promise.resolve() as Promise<unknown> & {
        onConflictDoUpdate: (config: Record<string, unknown>) => Promise<unknown[]>;
      };
      p.onConflictDoUpdate = (config) => {
        reviewQueueUpsertConfig = config;
        return Promise.resolve([]);
      };
      return p;
    },
  }),
  update: () => ({
    set: (payload: Record<string, unknown>) => {
      reviewQueueUpdateSetPayload = payload;
      return {
        where: () => ({
          returning: () => Promise.resolve(reviewQueueReturnRows),
        }),
      };
    },
  }),
  select: (...args: unknown[]) => ({
    from: () => ({
      innerJoin: () => ({
        where: () => ({
          limit: () => Promise.resolve([...questionStore.values()].slice(0, 1)),
        }),
      }),
      where: () => ({
        limit: () => {
          if (args.length > 0 && args[0] != null) {
            return Promise.resolve([...sessionStore.values()].slice(0, 1));
          }
          return Promise.resolve([...questionStore.values()].slice(0, 1));
        },
      }),
    }),
  }),
};

vi.mock("@/db/client", () => ({
  createDb: () => mockDb,
  getDb: () => mockDb,
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
    sessionStore.clear();
    reviewQueueReturnRows = [];
    insertRowsHistory.length = 0;
    reviewQueueUpsertConfig = null;
    reviewQueueUpdateSetPayload = null;
    vi.restoreAllMocks();
  });

  describe("submitQuizAnswer", () => {
    it("不正解時に isReviewRegistered: true を返す", async () => {
      vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
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

      const reviewQueueRow = insertRowsHistory
        .flat()
        .find(
          (row) => typeof row.intervalDays === "number" && typeof row.nextReviewAt === "number",
        );
      expect(reviewQueueRow).toMatchObject({
        userId: "test-user-id",
        questionId: first.questionId,
        intervalDays: 1,
        wrongCount: 1,
        nextReviewAt: 1_700_000_000_000 + 24 * 60 * 60 * 1000,
      });
      expect(reviewQueueUpsertConfig).toMatchObject({
        set: {
          nextReviewAt: 1_700_000_000_000 + 24 * 60 * 60 * 1000,
          intervalDays: 1,
        },
      });
    });

    it("正解時かつ review_queue エントリがある場合 reviewNextAt を返す", async () => {
      vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
      const session = await startQuizSession({
        topic: "React Hooks",
        mode: "word",
        userId: "test-user-id",
      });
      const first = session.questions[0]!;

      // update().returning() が review_queue エントリを返すよう設定
      const expectedNextAt = Date.now() + 2 * 24 * 60 * 60 * 1000; // intervalDays=1 → 2倍 → 2日後（モックは直接返す）
      reviewQueueReturnRows = [{ id: "review-id", nextReviewAt: expectedNextAt }];

      // correctIndex = 0 なので selectedIndex = 0 は正解
      const result = await submitQuizAnswer({
        sessionId: session.sessionId,
        questionId: first.questionId,
        selectedIndex: 0,
        userId: "test-user-id",
      });

      expect(result.isCorrect).toBe(true);
      expect(result.isReviewRegistered).toBeUndefined();
      expect(result.reviewNextAt).toBe(expectedNextAt);
      expect(renderSql(reviewQueueUpdateSetPayload?.intervalDays)).toBe(
        "MIN(interval_days * 2, 30)",
      );
      expect(renderSql(reviewQueueUpdateSetPayload?.nextReviewAt)).toBe(
        "1700000000000 + MIN(interval_days * 2, 30) * 86400000",
      );
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
        prompt: "復習問題のプロンプト（先頭に来るはず）",
        choicesJson: JSON.stringify(["A", "B", "C", "D"]),
        correctIndex: 2,
        explanation: "復習解説",
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
      // 合計問題数が 0 より大きいこと
      expect(session.questions.length).toBeGreaterThan(0);
    });
  });
});

function renderSql(value: unknown): string {
  if (!value || typeof value !== "object" || !("queryChunks" in value)) return String(value);

  const queryChunks = (value as { queryChunks: unknown[] }).queryChunks;
  return queryChunks
    .map((chunk) => {
      if (chunk && typeof chunk === "object" && "value" in chunk) {
        return ((chunk as { value: string[] }).value ?? []).join("");
      }
      if (chunk && typeof chunk === "object" && "name" in chunk) {
        return String((chunk as { name: string }).name);
      }
      return String(chunk);
    })
    .join("");
}
