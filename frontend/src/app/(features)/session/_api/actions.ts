"use server";

import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import type { SubmitAnswerInput, SubmitAnswerResponse } from "./mutations";
import { startQuizSession, submitQuizAnswer } from "./mutations";

export async function submitQuizAnswerAction(
  input: SubmitAnswerInput,
): Promise<SubmitAnswerResponse> {
  const { userId } = await auth();
  return submitQuizAnswer({ ...input, userId: userId ?? undefined });
}

export async function continueSessionFormAction(formData: FormData): Promise<void> {
  const topic = String(formData.get("topic") ?? "").trim();
  const mode = String(formData.get("mode") ?? "word");

  if (!topic) return;
  if (mode !== "word" && mode !== "reading") return;

  const { userId } = await auth();
  const session = await startQuizSession({ topic, mode, userId: userId ?? "" });
  redirect(`/session/${session.sessionId}`);
}
