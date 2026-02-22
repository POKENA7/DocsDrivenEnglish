"use server";

import { redirect } from "next/navigation";

import { startQuizSession } from "@/app/(features)/session/_api/mutations";
import { requireUserId } from "@/lib/auth";

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
  redirect(`/session/${session.sessionId}`);
}
