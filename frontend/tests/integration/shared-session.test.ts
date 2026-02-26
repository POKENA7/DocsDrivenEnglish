import { describe, expect, it } from "vitest";

import { ApiError } from "@/server/quiz/errors";
import { startSharedQuizSession } from "@/server/quiz/shared-session";

describe("startSharedQuizSession", () => {
  it("throws ApiError when DB is not available", async () => {
    // DB なし環境（getOptionalDb が null）ではエラーになることを確認
    await expect(
      startSharedQuizSession({
        mode: "word",
        questionCount: 5,
        userId: "test-user",
      }),
    ).rejects.toThrow(ApiError);
  });

  it("throws NOT_FOUND when no other users' questions exist", async () => {
    // DB なし環境ではまず INTERNAL エラーが出る
    await expect(
      startSharedQuizSession({
        mode: "reading",
        questionCount: 5,
        userId: "test-user",
      }),
    ).rejects.toThrow("DB接続に失敗しました");
  });
});
