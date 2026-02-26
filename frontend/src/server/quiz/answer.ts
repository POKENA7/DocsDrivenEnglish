import "server-only";

import { getDb } from "@/db/client";
import { reviewQueue } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";

import { recordAttempt } from "@/server/history/record";

import { ApiError } from "./errors";
import { getQuestion } from "./query";
import type { SubmitAnswerInput, SubmitAnswerResponse } from "./types";

export async function submitQuizAnswer(
  input: SubmitAnswerInput & { userId?: string },
): Promise<SubmitAnswerResponse> {
  const q = await getQuestion(input.questionId);
  if (!q || q.sessionId !== input.sessionId) {
    throw new ApiError("BAD_REQUEST", "問題が見つかりませんでした");
  }

  // Cloudflare Workers 経由で selectedIndex が文字列として届く場合を考慮して Number() で変換する
  const isCorrect = Number(input.selectedIndex) === q.correctIndex;

  if (input.userId) {
    await recordAttempt({
      userId: input.userId,
      sessionId: input.sessionId,
      questionId: input.questionId,
      selectedIndex: input.selectedIndex,
      isCorrect,
      explanation: q.explanation,
      answeredAt: new Date(),
    });
  }

  const out: SubmitAnswerResponse = { isCorrect, explanation: q.explanation };

  // ログイン済みの場合のみ review_queue を更新
  if (input.userId) {
    const db = getDb();
    // review_queue を更新する対象の questionId（複製元があればそちらを使う）
    const reviewKeyId = q.sourceQuestionId ?? q.questionId;
    const nowMs = Date.now();

    if (!isCorrect) {
      // 不正解: UPSERT（翌日に nextReviewAt をセット、wrongCount をインクリメント）
      const nextReviewAt = nowMs + 24 * 60 * 60 * 1000;
      await db
        .insert(reviewQueue)
        .values({
          id: crypto.randomUUID(),
          userId: input.userId,
          questionId: reviewKeyId,
          nextReviewAt,
          wrongCount: 1,
        })
        .onConflictDoUpdate({
          target: [reviewQueue.userId, reviewQueue.questionId],
          set: {
            nextReviewAt,
            wrongCount: sql`${reviewQueue.wrongCount} + 1`,
          },
        });
      out.isReviewRegistered = true;
    } else {
      // 正解: review_queue にエントリがある場合のみ nextReviewAt を 30 日後に更新
      const nextReviewAt = nowMs + 30 * 24 * 60 * 60 * 1000;
      const updated = await db
        .update(reviewQueue)
        .set({ nextReviewAt })
        .where(and(eq(reviewQueue.userId, input.userId), eq(reviewQueue.questionId, reviewKeyId)))
        .returning({ id: reviewQueue.id });
      if (updated.length > 0) {
        out.reviewNextAt = nextReviewAt;
      }
    }
  }

  return out;
}
