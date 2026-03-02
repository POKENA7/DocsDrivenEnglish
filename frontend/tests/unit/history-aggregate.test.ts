import { describe, expect, it, vi } from "vitest";

import { getHistorySummaryQuery } from "@/server/history/query";

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: { DB: {} } }),
}));

function makeDb(row: { attemptCount: number; correctRate: string | null; studyDays: number }) {
  return {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve([row]),
      }),
    }),
  };
}

vi.mock("@/db/client", () => ({
  getDb: vi.fn(),
}));

describe("getHistorySummaryQuery", () => {
  it("レコードがない場合はすべて 0 を返す", async () => {
    const { getDb } = await import("@/db/client");
    vi.mocked(getDb).mockReturnValue(
      makeDb({ attemptCount: 0, correctRate: null, studyDays: 0 }) as unknown as ReturnType<
        typeof getDb
      >,
    );

    const result = await getHistorySummaryQuery("user-1");

    expect(result).toEqual({ attemptCount: 0, correctRate: 0, studyDays: 0 });
  });

  it("DB の集計値を正しく HistorySummary にマッピングする", async () => {
    const { getDb } = await import("@/db/client");
    vi.mocked(getDb).mockReturnValue(
      makeDb({
        attemptCount: 3,
        correctRate: "0.6666666666666666",
        studyDays: 2,
      }) as unknown as ReturnType<typeof getDb>,
    );

    const result = await getHistorySummaryQuery("user-1");

    expect(result.attemptCount).toBe(3);
    expect(result.correctRate).toBeCloseTo(2 / 3);
    expect(result.studyDays).toBe(2);
  });
});
