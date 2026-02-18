"use server";

import { redirect } from "next/navigation";

import type { StartSessionResponse } from "@/app/api/[[...route]]/quiz";

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

  if (!topic) return;
  if (mode !== "word" && mode !== "reading") return;

  const session = await startSessionQuery({ topic, mode, questionCount });
  redirect(`/session/${session.sessionId}`);
}
