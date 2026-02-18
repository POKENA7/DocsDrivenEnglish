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

  if (!topic) return;
  if (mode !== "word" && mode !== "reading") return;

  const session = await startSessionQuery({ topic, mode });
  redirect(`/session/${session.sessionId}`);
}
