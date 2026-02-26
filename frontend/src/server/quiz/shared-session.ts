import "server-only";

import { getDb } from "@/db/client";
import { questions as questionsTable, reviewQueue, studySessions } from "@/db/schema";
import { and, eq, isNull, lte, ne, sql } from "drizzle-orm";

import { ApiError } from "./errors";
import { persistSession } from "./session";
import type { Mode, QuestionRecord, SessionRecord, StartSessionResponse } from "./types";

/**
 * 他のユーザーが作成した問題（questions テーブル）からランダムに取得してセッションを開始する。
 * - トピックによるフィルタは行わない
 * - 復習コピー（source_question_id あり）は除外
 * - study_sessions.user_id がリクエストユーザーでないセッションの問題を対象とする
 * - mode でフィルタする
 * - reviewQuestionCount が指定されていれば復習問題を先頭に組み込む
 */
export async function startSharedQuizSession(input: {
  mode: Mode;
  questionCount: number;
  reviewQuestionCount?: number;
  userId: string;
}): Promise<StartSessionResponse> {
  const db = getDb();

  const sessionId = crypto.randomUUID();

  // 期限切れ復習問題を取得
  const reviewQuestionCountRequested = input.reviewQuestionCount ?? 0;
  let reviewQuestions: QuestionRecord[] = [];
  if (reviewQuestionCountRequested > 0) {
    const now = Date.now();
    const dueRows = await db
      .select({
        questionId: questionsTable.questionId,
        prompt: questionsTable.prompt,
        choicesJson: questionsTable.choicesJson,
        correctIndex: questionsTable.correctIndex,
        explanation: questionsTable.explanation,
      })
      .from(reviewQueue)
      .innerJoin(questionsTable, eq(reviewQueue.questionId, questionsTable.questionId))
      .where(and(eq(reviewQueue.userId, input.userId), lte(reviewQueue.nextReviewAt, now)))
      .limit(reviewQuestionCountRequested);

    reviewQuestions = dueRows.map((row) => ({
      questionId: crypto.randomUUID(),
      sessionId,
      prompt: row.prompt,
      choices: JSON.parse(row.choicesJson) as string[],
      correctIndex: row.correctIndex,
      explanation: row.explanation,
      sourceQuestionId: row.questionId,
    }));
  }

  // 他ユーザーの問題を取得する件数 = questionCount - 復習問題数
  const sharedCount = input.questionCount - reviewQuestions.length;

  let sharedQuestions: QuestionRecord[] = [];
  if (sharedCount > 0) {
    const rows = await db
      .select({
        prompt: questionsTable.prompt,
        choicesJson: questionsTable.choicesJson,
        correctIndex: questionsTable.correctIndex,
        explanation: questionsTable.explanation,
      })
      .from(questionsTable)
      .innerJoin(studySessions, eq(questionsTable.sessionId, studySessions.sessionId))
      .where(
        and(
          ne(studySessions.userId, input.userId),
          isNull(questionsTable.sourceQuestionId),
          eq(questionsTable.mode, input.mode),
        ),
      )
      .orderBy(sql`RANDOM()`)
      .limit(sharedCount);

    sharedQuestions = rows.map((row) => ({
      questionId: crypto.randomUUID(),
      sessionId,
      prompt: row.prompt,
      choices: JSON.parse(row.choicesJson) as [string, string, string, string],
      correctIndex: row.correctIndex,
      explanation: row.explanation,
    }));
  }

  // 復習問題を先頭に、他ユーザーの問題を後ろに結合
  const questions: QuestionRecord[] = [...reviewQuestions, ...sharedQuestions];

  if (questions.length === 0) {
    throw new ApiError("NOT_FOUND", "まだ他のユーザーが作成したクイズがありません");
  }

  // セッションを組み立て・保存
  const topic = "他のユーザーが作成したクイズ";
  const session: SessionRecord = {
    sessionId,
    topic,
    mode: input.mode,
    plannedCount: questions.length,
    actualCount: questions.length,
    questions,
  };
  await persistSession(db, session);

  return {
    sessionId,
    plannedCount: session.plannedCount,
    actualCount: session.actualCount,
    topic: session.topic,
    questions: questions.map((q) => ({
      questionId: q.questionId,
      prompt: q.prompt,
      choices: q.choices.map((text, index) => ({ index, text })),
    })),
  };
}
