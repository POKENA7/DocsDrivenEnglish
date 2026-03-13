"use server";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";

import { z } from "zod";
import { auth } from "@clerk/nextjs/server";

import { requireUserId } from "@/lib/auth";

import { startQuizSession } from "@/server/quiz/session";
import { startSharedQuizSession } from "@/server/quiz/shared-session";
import { submitQuizAnswer } from "@/server/quiz/answer";
import { ApiError } from "@/server/quiz/errors";
import { fetchMoreExplanation } from "@/server/quiz/moreExplanation";
import { modeSchema } from "@/server/quiz/types";
import { getUserSettings } from "@/server/user-settings/query";
import type {
  SubmitAnswerInput,
  SubmitAnswerResponse,
  MoreExplanationInput,
  MoreExplanationResponse,
} from "@/server/quiz/types";

/* ------------------------------------------------------------------ */
/*  Zod スキーマ — FormData バリデーション                             */
/* ------------------------------------------------------------------ */
const articleKeySchema = z
  .string()
  .trim()
  .max(100)
  .regex(/^$|^hn-\d+-\d+$/, "articleKey が不正です");

const startSessionInput = z
  .object({
    topic: z.string().trim().min(1).max(300),
    articleKey: articleKeySchema,
    mode: modeSchema,
  })
  .transform((data) => ({
    ...data,
    articleKey: data.articleKey || null,
  }));

const sharedSessionInput = z.object({
  mode: modeSchema,
});

/* ------------------------------------------------------------------ */
/*  Server Actions                                                     */
/* ------------------------------------------------------------------ */

export async function startSessionFormAction(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const parsed = startSessionInput.safeParse({
    topic: formData.get("topic") ?? "",
    articleKey: formData.get("articleKey") ?? "",
    mode: formData.get("mode") ?? "word",
  });
  if (!parsed.success) return { error: "入力値が不正です。" };

  const userId = await requireUserId();
  const settings = await getUserSettings(userId);
  const session = await startQuizSession({
    topic: parsed.data.topic,
    sourceType: parsed.data.articleKey ? "hn_trend" : "manual",
    articleKey: parsed.data.articleKey,
    mode: parsed.data.mode,
    questionCount: settings.dailyGoalCount,
    reviewQuestionCount: settings.dailyReviewCount,
    userId,
  });
  redirect(`/learn/${session.sessionId}`);
}

export async function startSharedSessionFormAction(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const parsed = sharedSessionInput.safeParse({
    mode: formData.get("mode") ?? "word",
  });
  if (!parsed.success) return { error: null };

  const userId = await requireUserId();
  const settings = await getUserSettings(userId);

  try {
    const session = await startSharedQuizSession({
      ...parsed.data,
      questionCount: settings.dailyGoalCount,
      reviewQuestionCount: settings.dailyReviewCount,
      userId,
    });
    redirect(`/learn/${session.sessionId}`);
  } catch (e) {
    // redirect() は内部で特殊なエラーを throw するので再 throw する
    if (isRedirectError(e)) throw e;
    if (e instanceof ApiError && e.code === "NOT_FOUND") {
      return { error: e.message };
    }
    throw e;
  }
}

export async function submitQuizAnswerAction(
  input: SubmitAnswerInput,
): Promise<SubmitAnswerResponse> {
  const { userId } = await auth();
  // Cloudflare Workers 環境では Server Action の数値引数が文字列として届く場合があるため、
  // 明示的に数値へ変換してから渡す。
  return submitQuizAnswer({
    ...input,
    selectedIndex: Number(input.selectedIndex),
    userId: userId ?? undefined,
  });
}

export async function fetchMoreExplanationAction(
  input: MoreExplanationInput,
): Promise<MoreExplanationResponse> {
  await requireUserId();
  return fetchMoreExplanation(input);
}
