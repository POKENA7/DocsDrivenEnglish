import "server-only";

import { notFound } from "next/navigation";

import { getDb } from "@/db/client";
import {
  attempts,
  questions as questionsTable,
  reviewQueue,
  sessions as sessionsTable,
} from "@/db/schema";
import { and, eq, inArray, lte } from "drizzle-orm";
import { parseStringArrayColumn } from "@/server/json";

import { ApiError } from "./errors";
import type {
  QuestionRecord,
  ReviewQuestionRow,
  SessionRecord,
  StartSessionResponse,
} from "./types";

/**
 * 期限切れの復習問題を reviewQueue から取得する共通ヘルパー。
 * session.ts / shared-session.ts の両方から利用される。
 */
export async function fetchDueReviewQuestions(
  userId: string,
  limit: number,
): Promise<ReviewQuestionRow[]> {
  if (limit <= 0) return [];

  const db = getDb();
  const now = Date.now();

  return db
    .select({
      questionId: questionsTable.questionId,
      prompt: questionsTable.prompt,
      choicesJson: questionsTable.choicesJson,
      correctIndex: questionsTable.correctIndex,
      explanation: questionsTable.explanation,
    })
    .from(reviewQueue)
    .innerJoin(questionsTable, eq(reviewQueue.questionId, questionsTable.questionId))
    .where(and(eq(reviewQueue.userId, userId), lte(reviewQueue.nextReviewAt, now)))
    .limit(limit);
}

/**
 * ReviewQuestionRow[] の choicesJson をパースして QuestionRecord[] に変換する。
 * session.ts / shared-session.ts の両方から利用される。
 */
export function parseReviewQuestionRows(rows: ReviewQuestionRow[]): QuestionRecord[] {
  return rows.map((r) => ({
    questionId: r.questionId,
    prompt: r.prompt,
    choices: parseStringArrayColumn({
      columnName: "choices_json",
      raw: r.choicesJson,
    }),
    correctIndex: r.correctIndex,
    explanation: r.explanation,
  }));
}

/**
 * 問題リストをセッション開始レスポンス用の questions 形式に変換する。
 * session.ts / shared-session.ts の両方から利用される。
 */
export function toSessionQuestions(
  questions: Array<{ questionId: string; prompt: string; choices: string[] }>,
): StartSessionResponse["questions"] {
  return questions.map((q) => ({
    questionId: q.questionId,
    prompt: q.prompt,
    choices: q.choices.map((text, index) => ({ index, text })),
  }));
}

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
    choices: parseStringArrayColumn({
      columnName: "choices_json",
      raw: row.choicesJson,
    }),
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

  const questionIds = parseStringArrayColumn({
    columnName: "question_ids_json",
    raw: session.questionIdsJson,
  });

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
      choices: parseStringArrayColumn({
        columnName: "choices_json",
        raw: q.choicesJson,
      }),
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

export type SessionResult = {
  topic: string;
  mode: "word" | "reading";
  totalCount: number;
  correctCount: number;
  items: Array<{
    questionId: string;
    prompt: string;
    correctIndex: number;
    choices: string[];
    isCorrect: boolean;
  }>;
};

export async function getSessionResult(sessionId: string): Promise<SessionResult> {
  const db = getDb();

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.sessionId, sessionId))
    .limit(1);

  if (!session) notFound();

  const questionIds = parseStringArrayColumn({
    columnName: "question_ids_json",
    raw: session.questionIdsJson,
  });

  const [questionRows, attemptRows] = await Promise.all([
    db.select().from(questionsTable).where(inArray(questionsTable.questionId, questionIds)),
    db.select().from(attempts).where(eq(attempts.sessionId, sessionId)),
  ]);

  const questionMap = new Map(questionRows.map((q) => [q.questionId, q]));
  const attemptMap = new Map(attemptRows.map((a) => [a.questionId, a]));

  const items = questionIds
    .map((id) => {
      const q = questionMap.get(id);
      if (!q) return null;
      const attempt = attemptMap.get(id);
      return {
        questionId: q.questionId,
        prompt: q.prompt,
        correctIndex: q.correctIndex,
        choices: parseStringArrayColumn({
          columnName: "choices_json",
          raw: q.choicesJson,
        }),
        isCorrect: attempt?.isCorrect ?? false,
      };
    })
    .filter((item) => item != null);

  const correctCount = items.filter((item) => item.isCorrect).length;

  return {
    topic: session.topic,
    mode: session.mode as SessionResult["mode"],
    totalCount: items.length,
    correctCount,
    items,
  };
}
