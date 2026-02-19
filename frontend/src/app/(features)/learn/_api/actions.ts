"use server";

import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import type { StartSessionResponse } from "@/app/api/[[...route]]/quiz";
import { startQuizSession } from "@/app/api/[[...route]]/quiz";

import type { StartSessionInput } from "./query";
import { startSessionQuery } from "./query";

export async function startSessionAction(input: StartSessionInput): Promise<StartSessionResponse> {
  return startSessionQuery(input);
}

export async function startSessionFormAction(formData: FormData): Promise<void> {
  const topic = String(formData.get("topic") ?? "").trim();
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

  let userId: string | null = null;
  try {
    const { userId: uid } = await auth();
    userId = uid;
  } catch {
    // Clerk 未設定の場合は null のまま
  }

  const session = await startQuizSession({
    topic,
    mode: mode as "word" | "reading",
    questionCount,
    reviewQuestionCount,
    userId,
  });
  redirect(`/session/${session.sessionId}`);
}
