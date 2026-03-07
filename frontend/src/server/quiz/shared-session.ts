import "server-only";

import { getDb } from "@/db/client";
import { questions as questionsTable, sessions as sessionsTable } from "@/db/schema";
import { and, eq, ne, sql } from "drizzle-orm";

import { ApiError } from "./errors";
import { fetchDueReviewQuestions } from "./query";
import type { Mode, StartSessionResponse } from "./types";

const SHARED_TOPIC = "他のユーザーが作成したクイズ";

/**
 * 他のユーザーが作成した問題（questions テーブル）からランダムに取得してセッションを開始する。
 * - トピックによるフィルタは行わない
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

  // 期限切れ復習問題の questionId を取得
  const reviewQuestionCountRequested = input.reviewQuestionCount ?? 0;
  const reviewQuestionRows = await fetchDueReviewQuestions(
    input.userId,
    reviewQuestionCountRequested,
  );
  const reviewQuestionIds = reviewQuestionRows.map((r) => r.questionId);

  // 他ユーザーの問題を取得する件数 = questionCount - 復習問題数
  const sharedCount = input.questionCount - reviewQuestionIds.length;

  let sharedQuestionRows: Array<{
    questionId: string;
    prompt: string;
    choicesJson: string;
    correctIndex: number;
    explanation: string;
  }> = [];

  if (sharedCount > 0) {
    sharedQuestionRows = await db
      .select({
        questionId: questionsTable.questionId,
        prompt: questionsTable.prompt,
        choicesJson: questionsTable.choicesJson,
        correctIndex: questionsTable.correctIndex,
        explanation: questionsTable.explanation,
      })
      .from(questionsTable)
      .where(and(ne(questionsTable.userId, input.userId), eq(questionsTable.mode, input.mode)))
      .orderBy(sql`RANDOM()`)
      .limit(sharedCount);
  }

  const allQuestionIds = [...reviewQuestionIds, ...sharedQuestionRows.map((r) => r.questionId)];

  if (allQuestionIds.length === 0) {
    throw new ApiError("NOT_FOUND", "まだ他のユーザーが作成したクイズがありません");
  }

  const now = new Date();

  await db.insert(sessionsTable).values({
    sessionId,
    userId: input.userId,
    topic: SHARED_TOPIC,
    sourceType: "shared",
    mode: input.mode,
    questionIdsJson: JSON.stringify(allQuestionIds),
    createdAt: now,
  });

  // レスポンス組み立て（復習問題 + 他ユーザー問題の順）
  const allQuestions = [
    ...reviewQuestionRows.map((r) => ({
      questionId: r.questionId,
      prompt: r.prompt,
      choices: JSON.parse(r.choicesJson) as string[],
    })),
    ...sharedQuestionRows.map((r) => ({
      questionId: r.questionId,
      prompt: r.prompt,
      choices: JSON.parse(r.choicesJson) as string[],
    })),
  ];

  return {
    sessionId,
    topic: SHARED_TOPIC,
    sourceType: "shared",
    questions: allQuestions.map((q) => ({
      questionId: q.questionId,
      prompt: q.prompt,
      choices: q.choices.map((text, index) => ({ index, text })),
    })),
  };
}
