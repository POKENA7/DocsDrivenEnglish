import { beforeEach, describe, expect, it, vi } from "vitest";

import { startQuizSession } from "@/server/quiz/session";
import { submitQuizAnswer } from "@/server/quiz/answer";

// DB に永続化されたレコードを保持するフェイクストア
const questionStore = new Map<string, Record<string, unknown>>();
const sessionStore = new Map<string, Record<string, unknown>>();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: { DB: {} } }),
}));

const mockDb = {
  insert: () => ({
    values: (data: unknown) => {
      const rows = Array.isArray(data) ? data : [data];
      for (const row of rows as Record<string, unknown>[]) {
        if (typeof row.questionId === "string" && typeof row.prompt === "string") {
          questionStore.set(row.questionId as string, row);
        }
        if (typeof row.questionIdsJson === "string") {
          sessionStore.set(row.sessionId as string, row);
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
        returning: () => Promise.resolve([]),
      }),
    }),
  }),
  select: (...args: unknown[]) => ({
    from: () => ({
      innerJoin: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
      where: () => ({
        limit: () => {
          // select({...}) → sessions テーブルクエリ / select() → questions テーブルクエリ
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

vi.mock("@/lib/openaiClient", () => {
  return {
    OPENAI_MAX_OUTPUT_TOKENS: 10,
    OPENAI_TIMEOUT_MS: 1000,
    createOpenAIParsedText: vi.fn(
      async (_input: string, _model: string, _schema: unknown, schemaName: string) => {
        if (schemaName === "quiz_items_ja") {
          return {
            items: [
              {
                prompt:
                  "次の英文の意味として最も適切なものを選んでください。\n英文: Some content for quiz.",
                choices: ["ダミー1", "ダミー2", "ダミー3", "ダミー4"],
                correctIndex: 0,
                explanation: "ダミー解説",
              },
            ],
          };
        }

        return {
          term: "term",
          prompt: "ダミー",
          choices: ["ダミー1", "ダミー2", "ダミー3", "ダミー4"],
          correctIndex: 0,
          explanation: "ダミー解説",
        };
      },
    ),
    createOpenAIResponse: vi.fn(async () => {
      return {
        output_text: "dummy",
      };
    }),
  };
});

describe("submitQuizAnswer", () => {
  beforeEach(() => {
    questionStore.clear();
    sessionStore.clear();
  });

  it("scores answer", async () => {
    const session = await startQuizSession({
      topic: "React Hooks",
      mode: "word",
      userId: "test-user-id",
    });

    const first = session.questions[0]!;

    const result = await submitQuizAnswer({
      sessionId: session.sessionId,
      questionId: first.questionId,
      selectedIndex: 0,
      userId: "test-user-id",
    });

    expect(typeof result.isCorrect).toBe("boolean");
    expect(typeof result.explanation).toBe("string");
  });

  it("正解インデックスを渡すと isCorrect: true を返す", async () => {
    const session = await startQuizSession({
      topic: "React Hooks",
      mode: "word",
      userId: "test-user-id",
    });

    const first = session.questions[0]!;

    // mock LLM は correctIndex: 0 を返すので selectedIndex: 0 は正解
    const result = await submitQuizAnswer({
      sessionId: session.sessionId,
      questionId: first.questionId,
      selectedIndex: 0,
      userId: "test-user-id",
    });

    expect(result.isCorrect).toBe(true);
  });

  it("不正解インデックスを渡すと isCorrect: false を返す", async () => {
    const session = await startQuizSession({
      topic: "React Hooks",
      mode: "word",
      userId: "test-user-id",
    });

    const first = session.questions[0]!;

    // mock LLM は correctIndex: 0 を返すので selectedIndex: 1 は不正解
    const result = await submitQuizAnswer({
      sessionId: session.sessionId,
      questionId: first.questionId,
      selectedIndex: 1,
      userId: "test-user-id",
    });

    expect(result.isCorrect).toBe(false);
  });

  it("selectedIndex が文字列型で渡されても正誤判定が正しく動作する（型強制バグの修正確認）", async () => {
    const session = await startQuizSession({
      topic: "React Hooks",
      mode: "word",
      userId: "test-user-id",
    });

    const first = session.questions[0]!;

    // Cloudflare Workers 環境で selectedIndex が "0" (string) として届くケースを再現
    const result = await submitQuizAnswer({
      sessionId: session.sessionId,
      questionId: first.questionId,
      selectedIndex: "0" as unknown as number,
      userId: "test-user-id",
    });

    expect(result.isCorrect).toBe(true);
  });

  it("存在しない questionId を渡すと NOT_FOUND エラーを投げる", async () => {
    // questionStore が空の状態（beforeEach で clear 済み）で呼び出す
    await expect(
      submitQuizAnswer({
        sessionId: "some-session-id",
        questionId: "non-existent-question-id",
        selectedIndex: 0,
        userId: "test-user-id",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("questionId と sessionId が不一致の場合は BAD_REQUEST エラーを投げる", async () => {
    const session = await startQuizSession({
      topic: "React Hooks",
      mode: "word",
      userId: "test-user-id",
    });

    const first = session.questions[0]!;

    // sessionStore をクリアして wrong-session-id が見つからないようにする
    sessionStore.clear();

    await expect(
      submitQuizAnswer({
        sessionId: "wrong-session-id",
        questionId: first.questionId,
        selectedIndex: 0,
        userId: "test-user-id",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
