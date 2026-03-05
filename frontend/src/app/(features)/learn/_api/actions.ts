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
import type {
  SubmitAnswerInput,
  SubmitAnswerResponse,
  MoreExplanationInput,
  MoreExplanationResponse,
} from "@/server/quiz/types";

/* ------------------------------------------------------------------ */
/*  Zod スキーマ — FormData バリデーション                             */
/* ------------------------------------------------------------------ */
const questionCountSchema = z.coerce.number().int().min(1).max(20).catch(10);
const reviewQuestionCountSchema = z.coerce.number().int().min(0).catch(0);

const startSessionInput = z
  .object({
    topic: z.string().trim().min(1).max(200),
    mode: modeSchema,
    questionCount: questionCountSchema,
    reviewQuestionCount: reviewQuestionCountSchema,
  })
  .transform((d) => ({
    ...d,
    reviewQuestionCount: Math.min(d.reviewQuestionCount, d.questionCount - 1),
  }));

const sharedSessionInput = z
  .object({
    mode: modeSchema,
    questionCount: questionCountSchema,
    reviewQuestionCount: reviewQuestionCountSchema,
  })
  .transform((d) => ({
    ...d,
    reviewQuestionCount: Math.min(d.reviewQuestionCount, d.questionCount - 1),
  }));

const continueSessionInput = z.object({
  topic: z.string().trim().min(1),
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
    mode: formData.get("mode") ?? "word",
    questionCount: formData.get("questionCount") ?? 10,
    reviewQuestionCount: formData.get("reviewQuestionCount") ?? 0,
  });
  if (!parsed.success) return { error: "入力値が不正です。" };

  const userId = await requireUserId();
  const session = await startQuizSession({ ...parsed.data, userId });
  redirect(`/learn/${session.sessionId}`);
}

export async function startSharedSessionFormAction(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const parsed = sharedSessionInput.safeParse({
    mode: formData.get("mode") ?? "word",
    questionCount: formData.get("questionCount") ?? 10,
    reviewQuestionCount: formData.get("reviewQuestionCount") ?? 0,
  });
  if (!parsed.success) return { error: null };

  const userId = await requireUserId();

  try {
    const session = await startSharedQuizSession({ ...parsed.data, userId });
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

export async function continueSessionFormAction(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const parsed = continueSessionInput.safeParse({
    topic: formData.get("topic") ?? "",
    mode: formData.get("mode") ?? "word",
  });
  if (!parsed.success) return { error: "入力値が不正です。" };

  const userId = await requireUserId();
  const session = await startQuizSession({ ...parsed.data, userId });
  redirect(`/learn/${session.sessionId}`);
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
