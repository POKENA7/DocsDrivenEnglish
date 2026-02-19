"use server";

import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import type { StartSessionResponse, SubmitAnswerResponse } from "@/app/api/[[...route]]/quiz";
import { submitQuizAnswer } from "@/app/api/[[...route]]/quiz";

import type { ContinueSessionInput, SubmitAnswerInput } from "./query";
import { continueSessionQuery } from "./query";

export async function continueSessionAction(
  input: ContinueSessionInput,
): Promise<StartSessionResponse> {
  return continueSessionQuery(input);
}

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

  const session = await continueSessionQuery({ topic, mode });
  redirect(`/session/${session.sessionId}`);
}
