import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import { createDb } from "@/db/client";
import { attempts as attemptsTable } from "@/db/schema";
import { requireUserId } from "@/lib/auth";

type PersistedAttemptInput = {
  sessionId: string;
  questionId: string;
  selectedIndex: number;
  isCorrect: boolean;
  explanation: string | null;
  answeredAt: Date;
};

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
