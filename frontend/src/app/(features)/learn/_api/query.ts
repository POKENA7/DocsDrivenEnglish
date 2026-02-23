import "server-only";

import { createDb, getOptionalDb } from "@/db/client";
import { questions as questionsTable, studySessions } from "@/db/schema";
import { eq } from "drizzle-orm";

import type { QuestionRecord, SessionRecord } from "../_types";

export async function getQuestion(
  db: ReturnType<typeof createDb> | null,
  questionId: string,
): Promise<QuestionRecord | null> {
  if (!db) return null;

  const rows = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.questionId, questionId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    questionId: row.questionId,
    sessionId: row.sessionId,
    prompt: row.prompt,
    choices: JSON.parse(row.choicesJson) as string[],
    correctIndex: row.correctIndex,
    explanation: row.explanation,
    sourceQuestionId: row.sourceQuestionId ?? undefined,
  };
}

export async function getSessionSnapshot(sessionId: string): Promise<SessionRecord | null> {
  const db = getOptionalDb();
  if (!db) return null;

  const sessionRows = await db
    .select()
    .from(studySessions)
    .where(eq(studySessions.sessionId, sessionId))
    .limit(1);

  const session = sessionRows[0];
  if (!session) return null;

  const questionRows = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.sessionId, sessionId));

  const questions: QuestionRecord[] = questionRows.map((q) => ({
    questionId: q.questionId,
    sessionId: q.sessionId,
    prompt: q.prompt,
    choices: JSON.parse(q.choicesJson) as string[],
    correctIndex: q.correctIndex,
    explanation: q.explanation,
  }));

  return {
    sessionId: session.sessionId,
    topic: session.topic,
    mode: session.mode as SessionRecord["mode"],
    plannedCount: session.plannedCount,
    actualCount: session.actualCount,
    questions,
  };
}
