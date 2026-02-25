"use server";

import { redirect } from "next/navigation";

import { requireUserId } from "@/lib/auth";

import { startSingleReviewSession } from "@/server/quiz/session";

export async function retryReviewItemAction(formData: FormData): Promise<void> {
  const questionId = String(formData.get("questionId") ?? "").trim();
  if (!questionId) return;

  const userId = await requireUserId();
  const { sessionId } = await startSingleReviewSession({ questionId, userId });
  redirect(`/learn/${sessionId}`);
}
