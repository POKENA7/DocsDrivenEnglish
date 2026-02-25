import "server-only";

import { getOptionalDb } from "@/db/client";
import { sharedQuestions } from "@/db/schema";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { generateQuizItemsFromTopic } from "./generate";
import { ApiError } from "./errors";
import { persistSession } from "./session";
import type { Mode, QuestionRecord, SessionRecord, StartSessionResponse } from "./types";

// shared_questions から取得した行の型
type SharedQuestionRow = typeof sharedQuestions.$inferSelect;

// shared_questions から取得した問題が questionCount の 80% 以上あれば AI 生成なしで再利用する
const REUSE_THRESHOLD_RATIO = 0.8;

export async function startSharedQuizSession(input: {
  topic: string;
  mode: Mode;
  questionCount: number;
  userId: string;
}): Promise<StartSessionResponse> {
  const normalizedTopic = input.topic.trim().toLowerCase();
  const db = getOptionalDb();
  const sessionId = crypto.randomUUID();

  // 1. shared_questions から取得（play_count 昇順 → ランダム順で均等分散）
  let sharedRows: SharedQuestionRow[] = [];
  if (db) {
    sharedRows = await db
      .select()
      .from(sharedQuestions)
      .where(and(eq(sharedQuestions.topic, normalizedTopic), eq(sharedQuestions.mode, input.mode)))
      .orderBy(asc(sharedQuestions.playCount), sql`RANDOM()`)
      .limit(input.questionCount);
  }

  // 2. 閾値未満なら不足分を AI 生成
  const reuseThreshold = Math.ceil(input.questionCount * REUSE_THRESHOLD_RATIO);
  let aiGeneratedQuestions: QuestionRecord[] = [];

  if (sharedRows.length < reuseThreshold) {
    const generateCount = input.questionCount - sharedRows.length;
    const generated = await generateQuizItemsFromTopic(input.topic, input.mode, generateCount);

    aiGeneratedQuestions = generated.map((item) => ({
      questionId: crypto.randomUUID(),
      sessionId,
      prompt: item.prompt,
      choices: item.choices as [string, string, string, string],
      correctIndex: item.correctIndex,
      explanation: item.explanation,
    }));

    // AI 生成分を shared_questions に保存
    if (db && aiGeneratedQuestions.length > 0) {
      await db.insert(sharedQuestions).values(
        aiGeneratedQuestions.map((q) => ({
          id: crypto.randomUUID(),
          topic: normalizedTopic,
          mode: input.mode,
          prompt: q.prompt,
          choicesJson: JSON.stringify(q.choices),
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          createdBy: input.userId,
          sourceSessionId: sessionId,
          playCount: 0,
          createdAt: new Date(),
        })),
      );
    }
  }

  // 3. shared_questions からの問題を QuestionRecord に変換
  const reusedQuestions: QuestionRecord[] = sharedRows.map((row) => ({
    questionId: crypto.randomUUID(),
    sessionId,
    prompt: row.prompt,
    choices: JSON.parse(row.choicesJson) as [string, string, string, string],
    correctIndex: row.correctIndex,
    explanation: row.explanation,
  }));

  // 4. play_count をインクリメント
  if (db && sharedRows.length > 0) {
    await db
      .update(sharedQuestions)
      .set({ playCount: sql`${sharedQuestions.playCount} + 1` })
      .where(
        inArray(
          sharedQuestions.id,
          sharedRows.map((r) => r.id),
        ),
      );
  }

  // 5. セッションを組み立て・保存
  const questions: QuestionRecord[] = [...reusedQuestions, ...aiGeneratedQuestions];
  if (questions.length === 0) {
    throw new ApiError("INTERNAL", "問題の生成に失敗しました");
  }

  const session: SessionRecord = {
    sessionId,
    topic: input.topic,
    mode: input.mode,
    plannedCount: questions.length,
    actualCount: questions.length,
    questions,
  };
  await persistSession(db, session);

  return {
    sessionId,
    plannedCount: session.plannedCount,
    actualCount: session.actualCount,
    topic: session.topic,
    questions: questions.map((q) => ({
      questionId: q.questionId,
      prompt: q.prompt,
      choices: q.choices.map((text, index) => ({ index, text })),
    })),
  };
}
