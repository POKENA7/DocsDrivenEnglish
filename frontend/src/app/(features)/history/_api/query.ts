import "server-only";

import { eq } from "drizzle-orm";

import { getOptionalDb } from "@/db/client";
import { attempts as attemptsTable } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { calculateHistorySummary } from "@/app/api/[[...route]]/history";

export type HistorySummary = {
  attemptCount: number;
  correctRate: number;
  studyDays: number;
};

export async function getHistorySummaryQuery(): Promise<HistorySummary> {
  const userId = await requireUserId();

  const db = getOptionalDb();
  if (!db) {
    return calculateHistorySummary([]);
  }

  const rows = await db
    .select({ answeredAt: attemptsTable.answeredAt, isCorrect: attemptsTable.isCorrect })
    .from(attemptsTable)
    .where(eq(attemptsTable.userId, userId));

  return calculateHistorySummary(rows);
}
