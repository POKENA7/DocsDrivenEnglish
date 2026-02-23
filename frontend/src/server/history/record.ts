import "server-only";

import { getOptionalDb } from "@/db/client";
import { attempts as attemptsTable } from "@/db/schema";

type RecordAttemptInput = {
  userId: string;
  sessionId: string;
  questionId: string;
  selectedIndex: number;
  isCorrect: boolean;
  explanation: string | null;
  answeredAt: Date;
};

export async function recordAttempt(input: RecordAttemptInput): Promise<void> {
  const db = getOptionalDb();
  if (!db) return;

  await db.insert(attemptsTable).values({
    attemptId: crypto.randomUUID(),
    sessionId: input.sessionId,
    questionId: input.questionId,
    userId: input.userId,
    selectedIndex: input.selectedIndex,
    isCorrect: input.isCorrect,
    explanation: input.explanation,
    answeredAt: input.answeredAt,
  });
}
