import "server-only";

import { notFound } from "next/navigation";

import { getDb } from "@/db/client";
import { questions as questionsTable, studySessions } from "@/db/schema";
import { eq } from "drizzle-orm";

import { ApiError } from "./errors";
import type { QuestionRecord, SessionRecord } from "./types";

export async function getQuestion(questionId: string): Promise<QuestionRecord> {
  const db = getDb();

  const rows = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.questionId, questionId))
    .limit(1);

  const row = rows[0];
  if (!row) throw new ApiError("NOT_FOUND", "問題が見つかりませんでした");

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

export async function getSessionSnapshot(sessionId: string): Promise<SessionRecord> {
  const db = getDb();

  const sessionRows = await db
    .select()
    .from(studySessions)
    .where(eq(studySessions.sessionId, sessionId))
    .limit(1);

  const session = sessionRows[0];
  if (!session) notFound();

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
