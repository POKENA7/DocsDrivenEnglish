import "server-only";

import { notFound } from "next/navigation";

import { getDb } from "@/db/client";
import { questions as questionsTable, sessions as sessionsTable } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

import { ApiError } from "./errors";
import type { QuestionRecord, SessionRecord } from "./types";

export async function getQuestion(questionId: string): Promise<QuestionRecord> {
  const db = getDb();

  const [row] = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.questionId, questionId))
    .limit(1);

  if (!row) throw new ApiError("NOT_FOUND", "問題が見つかりませんでした");

  return {
    questionId: row.questionId,
    prompt: row.prompt,
    choices: JSON.parse(row.choicesJson) as string[],
    correctIndex: row.correctIndex,
    explanation: row.explanation,
  };
}

export async function getSessionSnapshot(sessionId: string): Promise<SessionRecord> {
  const db = getDb();

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.sessionId, sessionId))
    .limit(1);

  if (!session) notFound();

  const questionIds = JSON.parse(session.questionIdsJson) as string[];

  const questionRows = await db
    .select()
    .from(questionsTable)
    .where(inArray(questionsTable.questionId, questionIds));

  // questionIdsJson の順序を保持する
  const questionMap = new Map(questionRows.map((q) => [q.questionId, q]));
  const questions: QuestionRecord[] = questionIds
    .map((id) => questionMap.get(id))
    .filter((q) => q != null)
    .map((q) => ({
      questionId: q.questionId,
      prompt: q.prompt,
      choices: JSON.parse(q.choicesJson) as string[],
      correctIndex: q.correctIndex,
      explanation: q.explanation,
    }));

  return {
    sessionId: session.sessionId,
    topic: session.topic,
    mode: session.mode as SessionRecord["mode"],
    questions,
  };
}
