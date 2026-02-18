import "server-only";

import { Hono } from "hono";

import { getCloudflareContext } from "@opennextjs/cloudflare";

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

export const inMemoryAttemptsByUser = new Map<string, AttemptRecord[]>();

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

function getOptionalDb() {
  try {
    const { env } = getCloudflareContext();
    const db = (env as Record<string, unknown>).DB;
    if (!db) return null;
    return createDb(db as import("@cloudflare/workers-types").D1Database);
  } catch {
    return null;
  }
}

export async function recordAttemptIfLoggedIn(attempt: PersistedAttemptInput) {
  const userId = await getOptionalUserId();
  if (!userId) return;

  const db = getOptionalDb();

  // DB がある場合は DB のみに書き込む。
  // DB がない場合（next dev 等）はインメモリ Map にフォールバック。
  if (db) {
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
  } else {
    recordAttemptForUser(userId, { answeredAt: attempt.answeredAt, isCorrect: attempt.isCorrect });
  }
}

const app = new Hono().get("/summary", async (c) => {
  const userId = await requireUserId();

  const db = getOptionalDb();
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
