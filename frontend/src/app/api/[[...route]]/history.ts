import "server-only";

import { Hono } from "hono";

import { requireUserId } from "@/lib/auth";
import { getOptionalDb } from "@/db/client";
import { attempts as attemptsTable } from "@/db/schema";
import { eq } from "drizzle-orm";

type AttemptRecord = {
  answeredAt: Date;
  isCorrect: boolean;
};

type PersistedAttemptInput = {
  sessionId: string;
  questionId: string;
  selectedIndex: number;
  isCorrect: boolean;
  explanation: string | null;
  answeredAt: Date;
};

export function calculateHistorySummary(attempts: AttemptRecord[]) {
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

export async function recordAttempt(attempt: PersistedAttemptInput) {
  const userId = await requireUserId();
  const db = getOptionalDb();
  if (!db) return;

  await db.insert(attemptsTable).values({
    attemptId: crypto.randomUUID(),
    sessionId: attempt.sessionId,
    questionId: attempt.questionId,
    userId,
    selectedIndex: attempt.selectedIndex,
    isCorrect: attempt.isCorrect,
    explanation: attempt.explanation,
    answeredAt: attempt.answeredAt,
  });
}

const app = new Hono().get("/summary", async (c) => {
  const userId = await requireUserId();

  const db = getOptionalDb();
  if (!db) {
    return c.json(calculateHistorySummary([]));
  }

  const rows = await db
    .select({ answeredAt: attemptsTable.answeredAt, isCorrect: attemptsTable.isCorrect })
    .from(attemptsTable)
    .where(eq(attemptsTable.userId, userId));

  const attempts: AttemptRecord[] = rows.map((r) => ({
    answeredAt: r.answeredAt,
    isCorrect: r.isCorrect,
  }));

  return c.json(calculateHistorySummary(attempts));
});

export default app;
