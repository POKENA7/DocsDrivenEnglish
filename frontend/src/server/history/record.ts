import "server-only";

import { getDb } from "@/db/client";
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
  const db = getDb();

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
