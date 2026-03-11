import "server-only";

import { getDb } from "@/db/client";
import { attempts as attemptsTable } from "@/db/schema";
import { avg, count, eq, sql, and } from "drizzle-orm";

export type DailyAttemptCount = {
  year: number;
  month: number;
  day: number;
  count: number;
};

type HistorySummary = {
  attemptCount: number;
  correctRate: number;
  studyDays: number;
};

export async function getHistorySummaryQuery(userId: string): Promise<HistorySummary> {
  const db = getDb();

  const [row] = await db
    .select({
      attemptCount: count(),
      correctRate: avg(attemptsTable.isCorrect),
      studyDays: sql<number>`COUNT(DISTINCT strftime('%Y-%m-%d', ${attemptsTable.answeredAt} / 1000, 'unixepoch'))`,
    })
    .from(attemptsTable)
    .where(eq(attemptsTable.userId, userId));

  return {
    attemptCount: row?.attemptCount ?? 0,
    correctRate: row?.correctRate ? Number(row.correctRate) : 0,
    studyDays: row?.studyDays ?? 0,
  };
}

export async function getDailyAttemptCountsQuery(userId: string): Promise<DailyAttemptCount[]> {
  const db = getDb();

  const rows = await db
    .select({
      year: sql<number>`CAST(strftime('%Y', ${attemptsTable.answeredAt} / 1000, 'unixepoch') AS INTEGER)`,
      month: sql<number>`CAST(strftime('%m', ${attemptsTable.answeredAt} / 1000, 'unixepoch') AS INTEGER)`,
      day: sql<number>`CAST(strftime('%d', ${attemptsTable.answeredAt} / 1000, 'unixepoch') AS INTEGER)`,
      count: count(),
    })
    .from(attemptsTable)
    .where(eq(attemptsTable.userId, userId))
    .groupBy(
      sql`strftime('%Y', ${attemptsTable.answeredAt} / 1000, 'unixepoch')`,
      sql`strftime('%m', ${attemptsTable.answeredAt} / 1000, 'unixepoch')`,
      sql`strftime('%d', ${attemptsTable.answeredAt} / 1000, 'unixepoch')`,
    )
    .orderBy(
      sql`strftime('%Y', ${attemptsTable.answeredAt} / 1000, 'unixepoch')`,
      sql`strftime('%m', ${attemptsTable.answeredAt} / 1000, 'unixepoch')`,
      sql`strftime('%d', ${attemptsTable.answeredAt} / 1000, 'unixepoch')`,
    );

  return rows;
}

export async function getTodayAttemptCount(userId: string): Promise<number> {
  const db = getDb();

  const [row] = await db
    .select({ count: count() })
    .from(attemptsTable)
    .where(
      and(
        eq(attemptsTable.userId, userId),
        sql`strftime('%Y-%m-%d', ${attemptsTable.answeredAt} / 1000, 'unixepoch') = date('now')`,
      ),
    );

  return row?.count ?? 0;
}
