import "server-only";

import { getDb } from "@/db/client";
import { reviewQueue, sessions as sessionsTable } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";

import { recordAttempt } from "@/server/history/record";

import { ApiError } from "./errors";
import { getQuestion } from "./query";
import type { SubmitAnswerInput, SubmitAnswerResponse } from "./types";

export async function submitQuizAnswer(
  input: SubmitAnswerInput & { userId?: string },
): Promise<SubmitAnswerResponse> {
  const q = await getQuestion(input.questionId);

  // セッションに該当 questionId が含まれるか検証
  const db = getDb();
  const [session] = await db
    .select({ questionIdsJson: sessionsTable.questionIdsJson })
    .from(sessionsTable)
    .where(eq(sessionsTable.sessionId, input.sessionId))
    .limit(1);

  if (!session) throw new ApiError("BAD_REQUEST", "セッションが見つかりません");

  const questionIds = JSON.parse(session.questionIdsJson) as string[];
  if (!questionIds.includes(input.questionId)) {
    throw new ApiError("BAD_REQUEST", "セッションが一致しません");
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
    const nowMs = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    if (!isCorrect) {
      // 不正解: UPSERT（翌日に nextReviewAt をセット、intervalDays をリセット、wrongCount をインクリメント）
      const nextReviewAt = nowMs + dayMs;
      await db
        .insert(reviewQueue)
        .values({
          id: crypto.randomUUID(),
          userId: input.userId,
          questionId: input.questionId,
          nextReviewAt,
          wrongCount: 1,
          intervalDays: 1,
        })
        .onConflictDoUpdate({
          target: [reviewQueue.userId, reviewQueue.questionId],
          set: {
            nextReviewAt,
            intervalDays: 1,
            wrongCount: sql`${reviewQueue.wrongCount} + 1`,
          },
        });
      out.isReviewRegistered = true;
    } else {
      // 正解: review_queue にエントリがある場合のみ intervalDays を 2 倍（上限 30 日）にして nextReviewAt を更新
      const updated = await db
        .update(reviewQueue)
        .set({
          intervalDays: sql`MIN(${reviewQueue.intervalDays} * 2, 30)`,
          nextReviewAt: sql`${nowMs} + MIN(${reviewQueue.intervalDays} * 2, 30) * ${dayMs}`,
        })
        .where(
          and(eq(reviewQueue.userId, input.userId), eq(reviewQueue.questionId, input.questionId)),
        )
        .returning({ id: reviewQueue.id, nextReviewAt: reviewQueue.nextReviewAt });
      if (updated.length > 0 && updated[0]) {
        out.reviewNextAt = updated[0].nextReviewAt;
      }
    }
  }

  return out;
}
