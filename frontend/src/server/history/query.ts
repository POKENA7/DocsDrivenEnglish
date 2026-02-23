import "server-only";

import { getOptionalDb } from "@/db/client";
import { attempts as attemptsTable } from "@/db/schema";
import { eq } from "drizzle-orm";

type AttemptRecord = {
  answeredAt: Date;
  isCorrect: boolean;
};

type HistorySummary = {
  attemptCount: number;
  correctRate: number;
  studyDays: number;
};

export function calculateHistorySummary(attempts: AttemptRecord[]): HistorySummary {
  const attemptCount = attempts.length;
  const correctCount = attempts.filter((a) => a.isCorrect).length;
  const correctRate = attemptCount === 0 ? 0 : correctCount / attemptCount;

  const days = new Set<string>();
  for (const a of attempts) {
    const d = new Date(a.answeredAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
    days.add(key);
  }

  return {
    attemptCount,
    correctRate,
    studyDays: days.size,
  };
}

export async function getHistorySummaryQuery(userId: string): Promise<HistorySummary> {
  const db = getOptionalDb();
  if (!db) return calculateHistorySummary([]);

  const rows = await db
    .select({ answeredAt: attemptsTable.answeredAt, isCorrect: attemptsTable.isCorrect })
    .from(attemptsTable)
    .where(eq(attemptsTable.userId, userId));

  return calculateHistorySummary(rows);
}
