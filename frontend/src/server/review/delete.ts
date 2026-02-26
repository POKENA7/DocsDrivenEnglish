import "server-only";

import { getOptionalDb } from "@/db/client";
import { reviewQueue } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function deleteReviewItem({
  userId,
  questionId,
}: {
  userId: string;
  questionId: string;
}): Promise<void> {
  const db = getOptionalDb();
  if (!db) return;

  await db
    .delete(reviewQueue)
    .where(and(eq(reviewQueue.userId, userId), eq(reviewQueue.questionId, questionId)));
}
