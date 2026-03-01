import "server-only";

import { getDb } from "@/db/client";
import { attempts as attemptsTable } from "@/db/schema";
import { avg, count, eq, sql } from "drizzle-orm";

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
