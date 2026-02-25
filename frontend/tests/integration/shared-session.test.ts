import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/quiz/errors";
import { startSharedQuizSession } from "@/server/quiz/shared-session";

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

describe("startSharedQuizSession", () => {
  it("returns valid session (DB なし: AI 生成にフォールバック)", async () => {
    // DB なし環境（getOptionalDb が null）では AI 生成問題のみで構成されることを確認
    const result = await startSharedQuizSession({
      topic: "React Hooks",
      mode: "word",
      questionCount: 5,
      userId: "test-user",
    });

    expect(result.sessionId).toBeTruthy();
    expect(result.topic).toBe("React Hooks");
    expect(Array.isArray(result.questions)).toBe(true);
    expect(result.questions.length).toBeGreaterThan(0);
    expect(result.questions[0]).toMatchObject({
      questionId: expect.any(String),
      prompt: expect.any(String),
      choices: expect.any(Array),
    });
  });

  it("throws ApiError when AI generation returns no items", async () => {
    vi.mocked((await import("@/lib/openaiClient")).createOpenAIParsedText).mockResolvedValueOnce({
      items: [],
    } as never);

    await expect(
      startSharedQuizSession({
        topic: "React Hooks",
        mode: "word",
        questionCount: 5,
        userId: "test-user",
      }),
    ).rejects.toThrow(ApiError);
  });
});
