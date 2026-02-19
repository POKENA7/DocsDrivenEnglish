"use server";

import { redirect } from "next/navigation";

import type { SubmitAnswerResponse } from "@/app/api/[[...route]]/quiz";
import { submitQuizAnswer } from "@/app/api/[[...route]]/quiz";

import type { SubmitAnswerInput } from "./query";
import { continueSessionQuery } from "./query";

export async function submitQuizAnswerAction(
  input: SubmitAnswerInput,
): Promise<SubmitAnswerResponse> {
  return submitQuizAnswer(input);
}

export async function continueSessionFormAction(formData: FormData): Promise<void> {
  const topic = String(formData.get("topic") ?? "").trim();
  const mode = String(formData.get("mode") ?? "word");

  if (!topic) return;
  if (mode !== "word" && mode !== "reading") return;

  const session = await continueSessionQuery({ topic, mode });
  redirect(`/session/${session.sessionId}`);
}
