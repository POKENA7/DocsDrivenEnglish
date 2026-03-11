import { describe, expect, it, vi } from "vitest";

import { getUserSettings } from "@/server/user-settings/query";

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: { DB: {} } }),
}));

vi.mock("@/db/client", () => ({
  getDb: vi.fn(),
}));

function makeDb(rows: unknown[]) {
  const chain = {
    where: () => chain,
    limit: () => Promise.resolve(rows),
  };
  return {
    select: () => ({
      from: () => chain,
    }),
  };
}

describe("getUserSettings", () => {
  it("レコードがない場合はデフォルト値を返す", async () => {
    const { getDb } = await import("@/db/client");
    vi.mocked(getDb).mockReturnValue(makeDb([]) as ReturnType<typeof getDb>);

    const result = await getUserSettings("user-1");

    expect(result).toEqual({ dailyGoalCount: 10, dailyReviewCount: 2 });
  });

  it("保存済みの設定値を返す", async () => {
    const { getDb } = await import("@/db/client");
    vi.mocked(getDb).mockReturnValue(
      makeDb([{ userId: "user-1", dailyGoalCount: 15, dailyReviewCount: 3 }]) as ReturnType<
        typeof getDb
      >,
    );

    const result = await getUserSettings("user-1");

    expect(result).toEqual({ dailyGoalCount: 15, dailyReviewCount: 3 });
  });
});
