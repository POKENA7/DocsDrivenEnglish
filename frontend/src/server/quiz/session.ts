import "server-only";

import { getDb } from "@/db/client";
import { questions as questionsTable, reviewQueue, studySessions } from "@/db/schema";
import { and, eq, lte } from "drizzle-orm";

import { generateQuizItemsFromTopic } from "./generate";
import { ApiError } from "./errors";
import type { Mode, QuestionRecord, SessionRecord, StartSessionResponse } from "./types";

export async function persistSession(
  db: ReturnType<typeof getDb>,
  session: SessionRecord,
): Promise<void> {
  const now = new Date();

  await db.insert(studySessions).values({
    sessionId: session.sessionId,
    userId: null,
    topic: session.topic,
    mode: session.mode,
    plannedCount: session.plannedCount,
    actualCount: session.actualCount,
    createdAt: now,
    completedAt: null,
  });

  await db.insert(questionsTable).values(
    session.questions.map((q) => ({
      questionId: q.questionId,
      sessionId: q.sessionId,
      mode: session.mode,
      prompt: q.prompt,
      choicesJson: JSON.stringify(q.choices),
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      sourceQuestionId: q.sourceQuestionId ?? null,
      createdAt: now,
    })),
  );
}

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

  // 期限切れ復習問題を取得
  const reviewQuestionCountRequested = input.reviewQuestionCount ?? 0;
  let reviewQuestions: QuestionRecord[] = [];
  if (reviewQuestionCountRequested > 0) {
    const now = Date.now();
    const dueRows = await db
      .select({
        questionId: questionsTable.questionId,
        prompt: questionsTable.prompt,
        choicesJson: questionsTable.choicesJson,
        correctIndex: questionsTable.correctIndex,
        explanation: questionsTable.explanation,
      })
      .from(reviewQueue)
      .innerJoin(questionsTable, eq(reviewQueue.questionId, questionsTable.questionId))
      .where(and(eq(reviewQueue.userId, input.userId), lte(reviewQueue.nextReviewAt, now)))
      .limit(reviewQuestionCountRequested);

    // 復習問題は新しい sessionId・questionId で新規セッションに紐付ける
    // sourceQuestionId に元の questionId を記録し、回答時に review_queue を正しく更新できるようにする
    reviewQuestions = dueRows.map((row) => ({
      questionId: crypto.randomUUID(),
      sessionId,
      prompt: row.prompt,
      choices: JSON.parse(row.choicesJson) as string[],
      correctIndex: row.correctIndex,
      explanation: row.explanation,
      sourceQuestionId: row.questionId,
    }));
  }

  // 新規 AI 生成問題数 = plannedCount - 実際の復習問題数
  const newQuestionCount = plannedCount - reviewQuestions.length;
  const generated =
    newQuestionCount > 0
      ? await generateQuizItemsFromTopic(topic, input.mode, newQuestionCount)
      : [];

  const newQuestions: QuestionRecord[] = generated.map((item) => ({
    questionId: crypto.randomUUID(),
    sessionId,
    prompt: item.prompt,
    choices: item.choices as [string, string, string, string],
    correctIndex: item.correctIndex,
    explanation: item.explanation,
  }));

  // 復習問題を先頭に、AI 生成問題を後ろに結合
  const questions: QuestionRecord[] = [...reviewQuestions, ...newQuestions];

  const actualCount = questions.length;
  if (actualCount <= 0) {
    throw new ApiError("INTERNAL", "問題の生成に失敗しました");
  }

  const session: SessionRecord = {
    sessionId,
    topic,
    mode: input.mode,
    plannedCount,
    actualCount,
    questions,
  };

  await persistSession(db, session);

  return {
    sessionId,
    plannedCount,
    actualCount,
    topic: session.topic,
    questions: questions.map((q) => ({
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
      prompt: questionsTable.prompt,
      choicesJson: questionsTable.choicesJson,
      correctIndex: questionsTable.correctIndex,
      explanation: questionsTable.explanation,
      topic: studySessions.topic,
      mode: studySessions.mode,
    })
    .from(questionsTable)
    .innerJoin(studySessions, eq(questionsTable.sessionId, studySessions.sessionId))
    .where(eq(questionsTable.questionId, input.questionId))
    .limit(1);

  if (!row) throw new ApiError("NOT_FOUND", "問題が見つかりません");

  const sessionId = crypto.randomUUID();

  const question: QuestionRecord = {
    questionId: crypto.randomUUID(),
    sessionId,
    prompt: row.prompt,
    choices: JSON.parse(row.choicesJson) as [string, string, string, string],
    correctIndex: row.correctIndex,
    explanation: row.explanation,
    sourceQuestionId: input.questionId,
  };

  await persistSession(db, {
    sessionId,
    topic: row.topic,
    mode: row.mode as Mode,
    plannedCount: 1,
    actualCount: 1,
    questions: [question],
  });

  return { sessionId };
}
