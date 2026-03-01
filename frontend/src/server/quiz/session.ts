import "server-only";

import { getDb } from "@/db/client";
import { questions as questionsTable, sessions as sessionsTable } from "@/db/schema";
import { eq } from "drizzle-orm";

import { generateQuizItemsFromTopic } from "./generate";
import { ApiError } from "./errors";
import { fetchDueReviewQuestions } from "./query";
import type { Mode, StartSessionResponse } from "./types";

export async function startQuizSession(input: {
  topic: string;
  mode: Mode;
  questionCount?: number;
  reviewQuestionCount?: number;
  userId: string;
}): Promise<StartSessionResponse> {
  const topic = input.topic.trim();
  if (!topic) {
    throw new ApiError("BAD_REQUEST", "技術トピックを入力してください");
  }

  const db = getDb();
  const plannedCount = input.questionCount ?? 10;
  const sessionId = crypto.randomUUID();

  // 期限切れ復習問題の questionId を取得（questions への複製は行わない）
  const reviewQuestionCountRequested = input.reviewQuestionCount ?? 0;
  const reviewQuestionRows = await fetchDueReviewQuestions(
    input.userId,
    reviewQuestionCountRequested,
  );
  const reviewQuestionIds = reviewQuestionRows.map((r) => r.questionId);

  // 新規 AI 生成問題
  const newQuestionCount = plannedCount - reviewQuestionIds.length;
  const generated =
    newQuestionCount > 0
      ? await generateQuizItemsFromTopic(topic, input.mode, newQuestionCount)
      : [];

  const newQuestions = generated.map((item) => ({
    questionId: crypto.randomUUID(),
    prompt: item.prompt,
    choices: item.choices as [string, string, string, string],
    correctIndex: item.correctIndex,
    explanation: item.explanation,
  }));

  const allQuestionIds = [...reviewQuestionIds, ...newQuestions.map((q) => q.questionId)];
  if (allQuestionIds.length === 0) {
    throw new ApiError("INTERNAL", "問題の生成に失敗しました");
  }

  // DB 保存: sessions（全問題 ID を JSON 配列で保持）+ questions（新規生成分のみ INSERT）
  const now = new Date();

  await db.insert(sessionsTable).values({
    sessionId,
    userId: input.userId,
    topic,
    mode: input.mode,
    questionIdsJson: JSON.stringify(allQuestionIds),
    createdAt: now,
  });

  if (newQuestions.length > 0) {
    await db.insert(questionsTable).values(
      newQuestions.map((q) => ({
        questionId: q.questionId,
        userId: input.userId,
        mode: input.mode,
        topic,
        prompt: q.prompt,
        choicesJson: JSON.stringify(q.choices),
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        createdAt: now,
      })),
    );
  }

  // レスポンス組み立て（復習問題 + 新規問題の順）
  const allQuestions = [
    ...reviewQuestionRows.map((r) => ({
      questionId: r.questionId,
      prompt: r.prompt,
      choices: JSON.parse(r.choicesJson) as string[],
      correctIndex: r.correctIndex,
      explanation: r.explanation,
    })),
    ...newQuestions,
  ];

  return {
    sessionId,
    topic,
    questions: allQuestions.map((q) => ({
      questionId: q.questionId,
      prompt: q.prompt,
      choices: q.choices.map((text, index) => ({ index, text })),
    })),
  };
}

export async function startSingleReviewSession(input: {
  questionId: string;
  userId: string;
}): Promise<{ sessionId: string }> {
  const db = getDb();

  const [row] = await db
    .select({
      topic: questionsTable.topic,
      mode: questionsTable.mode,
    })
    .from(questionsTable)
    .where(eq(questionsTable.questionId, input.questionId))
    .limit(1);

  if (!row) throw new ApiError("NOT_FOUND", "問題が見つかりません");

  const sessionId = crypto.randomUUID();

  await db.insert(sessionsTable).values({
    sessionId,
    userId: input.userId,
    topic: row.topic,
    mode: row.mode,
    questionIdsJson: JSON.stringify([input.questionId]),
    createdAt: new Date(),
  });

  return { sessionId };
}
