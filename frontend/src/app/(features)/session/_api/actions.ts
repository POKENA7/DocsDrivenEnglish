"use server";

import { redirect } from "next/navigation";

import { startQuizSession } from "@/app/api/[[...route]]/quiz";

type ActionState = {
  error: string | null;
};

export async function continueSessionAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const url = String(formData.get("url") ?? "");
  const mode = String(formData.get("mode") ?? "word");

  if (mode !== "word" && mode !== "reading") {
    return { error: "mode が不正です" };
  }

  try {
    const session = await startQuizSession({ url, mode });
    redirect(`/session/${session.sessionId}`);
  } catch (e) {
    const message = e instanceof Error ? e.message : "エラーが発生しました";
    return { error: message };
  }
}
