import { describe, expect, it, vi } from "vitest";

import { ApiError, startQuizSession } from "@/app/(features)/session/_api/mutations";

vi.mock("@/lib/openaiClient", () => ({
  OPENAI_MAX_OUTPUT_TOKENS: 10,
  OPENAI_TIMEOUT_MS: 1000,
  // LLM が常に空配列を返すシナリオ
  createOpenAIParsedText: vi.fn(async () => ({ items: [] })),
}));

describe("startQuizSession errors", () => {
  it("throws ApiError when topic is empty", async () => {
    await expect(
      startQuizSession({ topic: "", mode: "word", userId: "test-user" }),
    ).rejects.toThrow(ApiError);
  });

  it("throws ApiError when topic is whitespace only", async () => {
    await expect(
      startQuizSession({ topic: "   ", mode: "word", userId: "test-user" }),
    ).rejects.toThrow(ApiError);
  });

  it("throws ApiError when LLM returns no items", async () => {
    await expect(
      startQuizSession({ topic: "React Hooks", mode: "word", userId: "test-user" }),
    ).rejects.toThrow(ApiError);
  });
});
