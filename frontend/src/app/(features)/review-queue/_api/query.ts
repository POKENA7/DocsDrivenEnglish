import "server-only";

import { cache } from "react";

import { getOptionalDb } from "@/db/client";
import { questions as questionsTable, reviewQueue } from "@/db/schema";
import { and, count, eq, lte } from "drizzle-orm";

export type ReviewQueueDisplayItem = {
  questionId: string;
  prompt: string;
  nextReviewAt: number;
  wrongCount: number;
};

// LearnPage バナー用: 期限切れ復習問題件数（React.cache でリクエスト内重複排除）
export const getDueReviewCount = cache(async (userId: string): Promise<number> => {
  const db = getOptionalDb();
  if (!db) return 0;

  const nowMs = Date.now();
  const [result] = await db
    .select({ count: count() })
    .from(reviewQueue)
    .where(and(eq(reviewQueue.userId, userId), lte(reviewQueue.nextReviewAt, nowMs)));

  return result?.count ?? 0;
});

// ReviewQueuePage 用: due / upcoming 分類して返す
export const getReviewQueue = cache(
  async (
    userId: string,
  ): Promise<{ dueItems: ReviewQueueDisplayItem[]; upcomingItems: ReviewQueueDisplayItem[] }> => {
    const db = getOptionalDb();
    if (!db) return { dueItems: [], upcomingItems: [] };

    const nowMs = Date.now();
    const rows = await db
      .select({
        questionId: questionsTable.questionId,
        prompt: questionsTable.prompt,
        nextReviewAt: reviewQueue.nextReviewAt,
        wrongCount: reviewQueue.wrongCount,
      })
      .from(reviewQueue)
      .innerJoin(questionsTable, eq(reviewQueue.questionId, questionsTable.questionId))
      .where(eq(reviewQueue.userId, userId))
      .orderBy(reviewQueue.nextReviewAt);

    return {
      dueItems: rows.filter((r) => r.nextReviewAt <= nowMs),
      upcomingItems: rows.filter((r) => r.nextReviewAt > nowMs),
    };
  },
);
