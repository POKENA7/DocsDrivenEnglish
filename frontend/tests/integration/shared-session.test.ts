import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/quiz/errors";
import { startSharedQuizSession } from "@/server/quiz/shared-session";

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
          orderBy: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
    }),
  }),
};

vi.mock("@/db/client", () => ({
  createDb: () => mockDb,
  getDb: () => mockDb,
}));

describe("startSharedQuizSession", () => {
  it("他のユーザーの問題が存在しない場合 NOT_FOUND を投げる", async () => {
    await expect(
      startSharedQuizSession({
        mode: "word",
        questionCount: 5,
        userId: "test-user",
      }),
    ).rejects.toThrow(ApiError);
  });

  it("他のユーザーの問題が存在しない場合エラーメッセージが正しい", async () => {
    await expect(
      startSharedQuizSession({
        mode: "reading",
        questionCount: 5,
        userId: "test-user",
      }),
    ).rejects.toThrow("まだ他のユーザーが作成したクイズがありません");
  });
});
