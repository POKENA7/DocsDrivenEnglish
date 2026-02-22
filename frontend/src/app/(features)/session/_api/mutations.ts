import "server-only";

import { z } from "zod";

import { createDb, getOptionalDb } from "@/db/client";
import { questions as questionsTable, reviewQueue, studySessions } from "@/db/schema";
import { and, eq, lte, sql } from "drizzle-orm";

import { createOpenAIParsedText } from "@/lib/openaiClient";

import { recordAttempt } from "@/app/(features)/history/_api/mutations";

export class ApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

type Mode = "word" | "reading";

export type StartSessionResponse = {
  sessionId: string;
  plannedCount: number;
  actualCount: number;
  topic: string;
  questions: Array<{
    questionId: string;
    prompt: string;
    choices: Array<{ index: number; text: string }>;
  }>;
};

export type SubmitAnswerResponse = {
  isCorrect: boolean;
  explanation: string;
  // 不正解時: 復習キューへの自動登録を通知 / 正解時(復習問題): 次回出題日時(ms)
  isReviewRegistered?: boolean;
  reviewNextAt?: number;
};

export type SubmitAnswerInput = {
  sessionId: string;
  questionId: string;
  selectedIndex: number;
};

type QuestionRecord = {
  questionId: string;
  sessionId: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  // 復習問題の複製元 questionId（通常問題は undefined）
  sourceQuestionId?: string;
};

type SessionRecord = {
  sessionId: string;
  topic: string;
  mode: Mode;
  plannedCount: number;
  actualCount: number;
  questions: QuestionRecord[];
};

const STRUCTURED_OUTPUTS_MODEL = "gpt-5-mini";

async function persistSession(
  db: ReturnType<typeof createDb> | null,
  session: SessionRecord,
): Promise<void> {
  if (!db) return;

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

async function getQuestion(
  db: ReturnType<typeof createDb> | null,
  questionId: string,
): Promise<QuestionRecord | null> {
  if (!db) return null;

  const rows = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.questionId, questionId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    questionId: row.questionId,
    sessionId: row.sessionId,
    prompt: row.prompt,
    choices: JSON.parse(row.choicesJson) as string[],
    correctIndex: row.correctIndex,
    explanation: row.explanation,
    sourceQuestionId: row.sourceQuestionId ?? undefined,
  };
}

export async function getSessionSnapshot(sessionId: string): Promise<SessionRecord | null> {
  const db = getOptionalDb();
  if (!db) return null;

  const sessionRows = await db
    .select()
    .from(studySessions)
    .where(eq(studySessions.sessionId, sessionId))
    .limit(1);

  const session = sessionRows[0];
  if (!session) return null;

  const questionRows = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.sessionId, sessionId));

  const questions: QuestionRecord[] = questionRows.map((q) => ({
    questionId: q.questionId,
    sessionId: q.sessionId,
    prompt: q.prompt,
    choices: JSON.parse(q.choicesJson) as string[],
    correctIndex: q.correctIndex,
    explanation: q.explanation,
  }));

  return {
    sessionId: session.sessionId,
    topic: session.topic,
    mode: session.mode as Mode,
    plannedCount: session.plannedCount,
    actualCount: session.actualCount,
    questions,
  };
}

type GeneratedQuizItem = {
  prompt: string;
  choices: string[];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
};

async function generateQuizItemsFromTopic(
  topic: string,
  mode: Mode,
  questionCount: number,
): Promise<GeneratedQuizItem[]> {
  const trimmedTopic = topic.trim();
  if (!trimmedTopic) return [];

  console.log("[quiz] generating quiz items, topic = ", { topic: trimmedTopic, questionCount });

  const QuizItemsSchema = z.object({
    items: z
      .array(
        z.object({
          prompt: z.string(),
          // NOTE: OpenAI Structured Outputs は JSON Schema の tuple 表現（items が配列）を受け付けないため、
          // 「配列 + min/max=4」で表現する。
          choices: z.array(z.string()).min(4).max(4),
          correctIndex: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
          explanation: z.string(),
        }),
      )
      .min(1)
      .max(questionCount),
  });

  const base =
    "あなたは『英語と技術の両方を学べるプログラマー向け英語学習サイト』のクイズ作成者です。\n" +
    "英語学習サイトであるため、出題内容は技術知識を前提とせず、英文を読むことで解ける内容にしてください。\n" +
    "扱う文章は技術ドキュメント（APIドキュメント/仕様/README/設計書など）に出てくる表現を想定しています。\n" +
    `技術トピック: ${trimmedTopic}\n` +
    "共通要件（厳守）:\n" +
    `- 必ず${questionCount}問作ること。\n` +
    "- prompt(問題文), choices(選択肢), explanation(解説)はすべて日本語。\n" +
    "- promptは以下のセクションとし、セクション間は改行すること。\n" +
    "  1) 問題文（日本語）\n" +
    "  2) 『原文:』で始まるセクションに、問題の根拠となる英文の想定例文を書く。\n" +
    "- choices は必ず4つ。正解は correctIndex(0-3) で示す。\n" +
    "- correctIndex は問題ごとに 0, 1, 2, 3 をまんべんなく使い、特定の位置に偏らないようにすること。\n" +
    "- 選択肢は『よくある誤読/別の語義/似た概念』など、学習価値がある紛らわしさにする（ただし重複や同義反復は避ける）。\n" +
    "- 4つの選択肢の文章量（文字数）はできるだけ揃えること。正解だけ長い・短いなど、文章量の偏りで正解が推測できてはいけない。\n" +
    "- 難易度は中〜上級を目指す。表面的な意味ではなく、文脈依存の意味・ニュアンス・論理関係を問うこと。\n" +
    "- 誤りの選択肢は『一見もっともらしいが原文を正確に読むと違う』ものにする。明らかに間違いとわかる選択肢は避ける。\n" +
    "- 解説は1文で簡潔に。\n" +
    "- 実在する技術ドキュメントの記述を想定した問題にし、造語・架空の用語は使わないこと。\n" +
    "- 同一セッション内で同じ単語・フレーズを重複して出題しないこと。\n";

  const modeSpecific =
    mode === "word"
      ? "word モード要件（厳守）:\n" +
        `- 『${trimmedTopic}』に深く関連した英単語/英語フレーズを1つ選び、『日本語の意味』を4択で問う。\n` +
        "- 基本的な意味ではなく、文脈上の意味やニュアンスを問う。多義語や文脈依存の語義を優先的に出題する。\n"
      : "reading モード要件（厳守）:\n" +
        `- 『${trimmedTopic}』の公式ドキュメント・仕様書に出てきそうな英文（3〜5文）を自ら構成し、その読解を問う。\n` +
        "- choices は本文の内容理解を問う日本語の選択肢にする（単なる逐語訳の4択にはしない）。\n" +
        "- 【重要】4つの選択肢はすべて同程度の長さ・詳しさで書くこと。正解の選択肢だけ具体的で長く、不正解が短く曖昧になるパターンは厳禁。不正解の選択肢も正解と同じレベルの具体性・もっともらしさで書く。\n" +
        "- 原文の論理構造（因果関係・条件・対比・限定）を正確に読み取らないと解けない問題を出す。表面的なキーワード一致では正解できないようにする。\n";

  const prompt = base + modeSpecific;

  const parsed = await createOpenAIParsedText(
    prompt,
    STRUCTURED_OUTPUTS_MODEL,
    QuizItemsSchema,
    "quiz_items_ja",
    { maxOutputTokens: 8000 },
  );

  return parsed.items.map((item) => ({
    ...item,
    prompt: item.prompt.trim(),
    explanation: item.explanation.trim(),
    choices: item.choices.map((c) => c.trim()),
  }));
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

  const db = getOptionalDb();
  const plannedCount = input.questionCount ?? 10;
  const sessionId = crypto.randomUUID();

  // 期限切れ復習問題を取得
  const reviewQuestionCountRequested = input.reviewQuestionCount ?? 0;
  let reviewQuestions: QuestionRecord[] = [];
  if (reviewQuestionCountRequested > 0 && db) {
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

export async function submitQuizAnswer(
  input: SubmitAnswerInput & { userId?: string },
): Promise<SubmitAnswerResponse> {
  const db = getOptionalDb();
  const q = await getQuestion(db, input.questionId);
  if (!q || q.sessionId !== input.sessionId) {
    throw new ApiError("BAD_REQUEST", "問題が見つかりませんでした");
  }

  const isCorrect = input.selectedIndex === q.correctIndex;

  await recordAttempt({
    sessionId: input.sessionId,
    questionId: input.questionId,
    selectedIndex: input.selectedIndex,
    isCorrect,
    explanation: q.explanation,
    answeredAt: new Date(),
  });

  const out: SubmitAnswerResponse = { isCorrect, explanation: q.explanation };

  // ログイン済みかつ DB が使える場合のみ review_queue を更新
  if (db && input.userId) {
    // review_queue を更新する対象の questionId（複製元があればそちらを使う）
    const reviewKeyId = q.sourceQuestionId ?? q.questionId;
    const nowMs = Date.now();

    if (!isCorrect) {
      // 不正解: UPSERT（翌日に nextReviewAt をセット、wrongCount をインクリメント）
      const nextReviewAt = nowMs + 24 * 60 * 60 * 1000;
      await db
        .insert(reviewQueue)
        .values({
          id: crypto.randomUUID(),
          userId: input.userId,
          questionId: reviewKeyId,
          nextReviewAt,
          wrongCount: 1,
        })
        .onConflictDoUpdate({
          target: [reviewQueue.userId, reviewQueue.questionId],
          set: {
            nextReviewAt,
            wrongCount: sql`${reviewQueue.wrongCount} + 1`,
          },
        });
      out.isReviewRegistered = true;
    } else {
      // 正解: review_queue にエントリがある場合のみ nextReviewAt を 30 日後に更新
      const nextReviewAt = nowMs + 30 * 24 * 60 * 60 * 1000;
      const updated = await db
        .update(reviewQueue)
        .set({ nextReviewAt })
        .where(and(eq(reviewQueue.userId, input.userId), eq(reviewQueue.questionId, reviewKeyId)))
        .returning({ id: reviewQueue.id });
      if (updated.length > 0) {
        out.reviewNextAt = nextReviewAt;
      }
    }
  }

  return out;
}
