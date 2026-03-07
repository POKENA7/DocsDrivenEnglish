import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/quiz/errors";
import { startQuizSession } from "@/server/quiz/session";

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: { DB: {} } }),
}));

const mockDb = {
  insert: () => ({
    values: () => Promise.resolve(),
  }),
  select: () => ({
    from: () => ({
      innerJoin: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    }),
  }),
};

vi.mock("@/db/client", () => ({
  createDb: () => mockDb,
  getDb: () => mockDb,
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
              prompt:
                "次の英文の意味として最も適切なものを選んでください。\n英文: Some content for quiz.",
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

describe("startQuizSession", () => {
  it("throws ApiError for empty topic", async () => {
    await expect(
      startQuizSession({
        topic: "",
        sourceType: "manual",
        articleKey: null,
        mode: "word",
        userId: "test-user",
      }),
    ).rejects.toThrow(ApiError);
  });

  it("returns valid session for valid input", async () => {
    const result = await startQuizSession({
      topic: "React Hooks",
      sourceType: "manual",
      articleKey: null,
      mode: "word",
      userId: "test-user",
    });

    expect(result.sessionId).toBeTruthy();
    expect(result.topic).toBe("React Hooks");
    expect(result.sourceType).toBe("manual");
    expect(Array.isArray(result.questions)).toBe(true);
  });

  it("respects custom questionCount", async () => {
    const result = await startQuizSession({
      topic: "React Hooks",
      sourceType: "manual",
      articleKey: null,
      mode: "word",
      questionCount: 3,
      userId: "test-user",
    });

    expect(result.questions).toHaveLength(1);
  });
});
