import { beforeEach, describe, expect, it, vi } from "vitest";

import { startQuizSession, submitQuizAnswer } from "@/app/(features)/learn/_api/mutations";

// DB に永続化された question を保持するフェイクストア
const questionStore = new Map<string, Record<string, unknown>>();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: { DB: {} } }),
}));

const mockDb = {
  insert: () => ({
    values: (data: unknown) => {
      const rows = Array.isArray(data) ? data : [data];
      for (const row of rows as Record<string, unknown>[]) {
        if (typeof row.questionId === "string") {
          questionStore.set(row.questionId, row);
        }
      }
      // onConflictDoUpdate チェーン対応（直接 await も .onConflictDoUpdate() チェーンも両方サポート）
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
  select: () => ({
    from: () => ({
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
});
