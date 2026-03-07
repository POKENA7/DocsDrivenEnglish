import "server-only";

import { getDb } from "@/db/client";
import { questions as questionsTable, sessions as sessionsTable } from "@/db/schema";
import { eq } from "drizzle-orm";

import { generateQuizItemsFromSource } from "./generate";
import { ApiError } from "./errors";
import { fetchDueReviewQuestions } from "./query";
import type { Mode, SourceType, StartSessionResponse } from "./types";

export async function startQuizSession(input: {
  displayTopic: string;
  sourceType: SourceType;
  sourceKey: string | null;
  mode: Mode;
  questionCount?: number;
  reviewQuestionCount?: number;
  userId: string;
}): Promise<StartSessionResponse> {
  const displayTopic = input.displayTopic.trim();
  if (!displayTopic) {
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

  const newQuestionCount = plannedCount - reviewQuestionIds.length;
  const generated =
    newQuestionCount > 0
      ? await generateQuizItemsFromSource({
          displayTopic,
          sourceType: input.sourceType,
          sourceKey: input.sourceKey,
          mode: input.mode,
          questionCount: newQuestionCount,
        })
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

  const now = new Date();

  await db.insert(sessionsTable).values({
    sessionId,
    userId: input.userId,
    topic: displayTopic,
    displayTopic,
    sourceType: input.sourceType,
    sourceKey: input.sourceKey,
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
        topic: displayTopic,
        displayTopic,
        sourceType: input.sourceType,
        sourceKey: input.sourceKey,
        prompt: q.prompt,
        choicesJson: JSON.stringify(q.choices),
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        createdAt: now,
      })),
    );
  }

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
    displayTopic,
    sourceType: input.sourceType,
    sourceKey: input.sourceKey,
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
      displayTopic: questionsTable.displayTopic,
      sourceType: questionsTable.sourceType,
      sourceKey: questionsTable.sourceKey,
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
    displayTopic: row.displayTopic ?? row.topic,
    sourceType: row.sourceType,
    sourceKey: row.sourceKey,
    mode: row.mode,
    questionIdsJson: JSON.stringify([input.questionId]),
    createdAt: new Date(),
  });

  return { sessionId };
}
