"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUserId } from "@/lib/auth";

import { deleteReviewItem } from "@/server/review/delete";
import { startSingleReviewSession } from "@/server/quiz/session";

export async function retryReviewItemAction(formData: FormData): Promise<void> {
  const questionId = String(formData.get("questionId") ?? "").trim();
  if (!questionId) return;

  const userId = await requireUserId();
  const { sessionId } = await startSingleReviewSession({ questionId, userId });
  redirect(`/learn/${sessionId}`);
}

export async function deleteReviewItemAction(questionId: string): Promise<void> {
  if (!questionId) return;

  const userId = await requireUserId();
  await deleteReviewItem({ userId, questionId });
  revalidatePath("/review-queue");
}
