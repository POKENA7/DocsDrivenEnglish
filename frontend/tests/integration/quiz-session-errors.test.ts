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
  // LLM が常に空配列を返すシナリオ
  createOpenAIParsedText: vi.fn(async () => ({ items: [] })),
}));

describe("startQuizSession errors", () => {
  it("throws ApiError when topic is empty", async () => {
    await expect(
      startQuizSession({
        displayTopic: "",
        sourceType: "manual",
        sourceKey: null,
        mode: "word",
        userId: "test-user",
      }),
    ).rejects.toThrow(ApiError);
  });

  it("throws ApiError when topic is whitespace only", async () => {
    await expect(
      startQuizSession({
        displayTopic: "   ",
        sourceType: "manual",
        sourceKey: null,
        mode: "word",
        userId: "test-user",
      }),
    ).rejects.toThrow(ApiError);
  });

  it("throws ApiError when LLM returns no items", async () => {
    await expect(
      startQuizSession({
        displayTopic: "React Hooks",
        sourceType: "manual",
        sourceKey: null,
        mode: "word",
        userId: "test-user",
      }),
    ).rejects.toThrow(ApiError);
  });
});
