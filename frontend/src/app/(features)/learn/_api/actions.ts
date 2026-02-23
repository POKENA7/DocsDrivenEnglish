"use server";

import { redirect } from "next/navigation";

import { auth } from "@clerk/nextjs/server";

import { requireUserId } from "@/lib/auth";

import { startQuizSession } from "@/server/quiz/session";
import { submitQuizAnswer } from "@/server/quiz/answer";
import type { SubmitAnswerInput, SubmitAnswerResponse } from "@/server/quiz/types";

export async function startSessionFormAction(formData: FormData): Promise<void> {
  const topic = String(formData.get("topic") ?? "")
    .trim()
    .slice(0, 200);
  const mode = String(formData.get("mode") ?? "word");
  const questionCountRaw = Number(formData.get("questionCount") ?? 10);
  const questionCount =
    Number.isInteger(questionCountRaw) && questionCountRaw >= 1 && questionCountRaw <= 20
      ? questionCountRaw
      : 10;
  const reviewQuestionCountRaw = Number(formData.get("reviewQuestionCount") ?? 0);
  const reviewQuestionCount =
    Number.isInteger(reviewQuestionCountRaw) && reviewQuestionCountRaw >= 0
      ? Math.min(reviewQuestionCountRaw, questionCount - 1)
      : 0;

  if (!topic) return;
  if (mode !== "word" && mode !== "reading") return;

  const userId = await requireUserId();

  const session = await startQuizSession({
    topic,
    mode: mode as "word" | "reading",
    questionCount,
    reviewQuestionCount,
    userId,
  });
  redirect(`/learn/${session.sessionId}`);
}

export async function continueSessionFormAction(formData: FormData): Promise<void> {
  const topic = String(formData.get("topic") ?? "").trim();
  const mode = String(formData.get("mode") ?? "word");

  if (!topic) return;
  if (mode !== "word" && mode !== "reading") return;

  const userId = await requireUserId();
  const session = await startQuizSession({ topic, mode: mode as "word" | "reading", userId });
  redirect(`/learn/${session.sessionId}`);
}

export async function submitQuizAnswerAction(
  input: SubmitAnswerInput,
): Promise<SubmitAnswerResponse> {
  const { userId } = await auth();
  return submitQuizAnswer({ ...input, userId: userId ?? undefined });
}
