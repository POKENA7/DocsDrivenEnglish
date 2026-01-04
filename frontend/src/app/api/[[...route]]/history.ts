import "server-only";

import type { D1Database } from "@cloudflare/workers-types";

import { Hono } from "hono";

import { getOptionalUserId, requireUserId } from "@/lib/auth";
import { createDb } from "@/db/client";
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

const inMemoryAttemptsByUser = new Map<string, AttemptRecord[]>();

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

export function recordAttemptForUser(userId: string, attempt: AttemptRecord) {
  const list = inMemoryAttemptsByUser.get(userId) ?? [];
  list.push(attempt);
  inMemoryAttemptsByUser.set(userId, list);
}

function getOptionalDbFromBindings(bindings: unknown) {
  const env = bindings as { DB?: D1Database } | null | undefined;
  const db = env?.DB;
  if (!db) return null;
  return createDb(db);
}

export async function recordAttemptIfLoggedIn(attempt: PersistedAttemptInput, bindings?: unknown) {
  const userId = await getOptionalUserId();
  if (!userId) return;

  recordAttemptForUser(userId, { answeredAt: attempt.answeredAt, isCorrect: attempt.isCorrect });

  const db = getOptionalDbFromBindings(bindings);
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

  const db = getOptionalDbFromBindings(c.env);
  if (!db) {
    const attempts = inMemoryAttemptsByUser.get(userId) ?? [];
    return c.json(calculateHistorySummary(attempts));
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
