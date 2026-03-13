import { describe, expect, it, vi } from "vitest";

import {
  getDailyAttemptCountsQuery,
  getHistorySummaryQuery,
  getTodayAttemptCount,
} from "@/server/history/query";

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

type DailyRow = { year: number; month: number; day: number; count: number };

function makeDailyDb(rows: DailyRow[]) {
  const chain = {
    groupBy: () => chain,
    orderBy: () => Promise.resolve(rows),
  };
  return {
    select: () => ({
      from: () => ({
        where: () => chain,
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

describe("getDailyAttemptCountsQuery", () => {
  it("レコードがない場合は空配列を返す", async () => {
    const { getDb } = await import("@/db/client");
    vi.mocked(getDb).mockReturnValue(makeDailyDb([]) as ReturnType<typeof getDb>);

    const result = await getDailyAttemptCountsQuery("user-1");

    expect(result).toEqual([]);
  });

  it("同日に複数回答がある場合は count が合算された行を返す", async () => {
    const { getDb } = await import("@/db/client");
    vi.mocked(getDb).mockReturnValue(
      makeDailyDb([{ year: 2026, month: 3, day: 1, count: 5 }]) as ReturnType<typeof getDb>,
    );

    const result = await getDailyAttemptCountsQuery("user-1");

    expect(result).toEqual([{ year: 2026, month: 3, day: 1, count: 5 }]);
  });

  it("複数日にまたがる場合は日ごとに集計して返す", async () => {
    const { getDb } = await import("@/db/client");
    const rows = [
      { year: 2026, month: 3, day: 1, count: 3 },
      { year: 2026, month: 3, day: 5, count: 7 },
    ];
    vi.mocked(getDb).mockReturnValue(makeDailyDb(rows) as ReturnType<typeof getDb>);

    const result = await getDailyAttemptCountsQuery("user-1");

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ year: 2026, month: 3, day: 1, count: 3 });
    expect(result[1]).toEqual({ year: 2026, month: 3, day: 5, count: 7 });
  });

  it("複数月にまたがる場合は year・month・day が正しく設定される", async () => {
    const { getDb } = await import("@/db/client");
    const rows = [
      { year: 2026, month: 1, day: 10, count: 2 },
      { year: 2026, month: 2, day: 20, count: 4 },
      { year: 2026, month: 3, day: 3, count: 1 },
    ];
    vi.mocked(getDb).mockReturnValue(makeDailyDb(rows) as ReturnType<typeof getDb>);

    const result = await getDailyAttemptCountsQuery("user-1");

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ year: 2026, month: 1, day: 10 });
    expect(result[1]).toMatchObject({ year: 2026, month: 2, day: 20 });
    expect(result[2]).toMatchObject({ year: 2026, month: 3, day: 3 });
  });
});

describe("getTodayAttemptCount", () => {
  function makeTodayDb(countValue: number) {
    return {
      select: () => ({
        from: () => ({
          where: () => Promise.resolve([{ count: countValue }]),
        }),
      }),
    };
  }

  it("今日の回答数を返す", async () => {
    const { getDb } = await import("@/db/client");
    vi.mocked(getDb).mockReturnValue(makeTodayDb(7) as ReturnType<typeof getDb>);

    const result = await getTodayAttemptCount("user-1");

    expect(result).toBe(7);
  });

  it("回答がない場合は 0 を返す", async () => {
    const { getDb } = await import("@/db/client");
    vi.mocked(getDb).mockReturnValue(makeTodayDb(0) as ReturnType<typeof getDb>);

    const result = await getTodayAttemptCount("user-1");

    expect(result).toBe(0);
  });
});
