import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteReviewItem } from "@/server/review/delete";

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: { DB: {} } }),
}));

vi.mock("@/db/client", () => ({
  getDb: () => ({
    delete: () => ({
      where: () => Promise.resolve(),
    }),
  }),
}));

describe("deleteReviewItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("存在するキューアイテムを自身のユーザIDで削除できる（例外なし）", async () => {
    await expect(
      deleteReviewItem({ userId: "user-1", questionId: "question-1" }),
    ).resolves.toBeUndefined();
  });

  it("存在しないアイテムを削除しても例外が発生しない", async () => {
    await expect(
      deleteReviewItem({ userId: "user-1", questionId: "nonexistent-question" }),
    ).resolves.toBeUndefined();
  });

  it("別ユーザのアイテムを指定しても例外が発生しない（SQLのWHERE句がデータを保護する）", async () => {
    await expect(
      deleteReviewItem({ userId: "other-user", questionId: "question-1" }),
    ).resolves.toBeUndefined();
  });
});
