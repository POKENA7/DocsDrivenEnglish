import "server-only";

import type { D1Database } from "@cloudflare/workers-types";

import { Hono } from "hono";

import { z } from "zod";

import { createOpenAIParsedText } from "@/lib/openaiClient";

import { createDb } from "@/db/client";
import { questions as questionsTable, studySessions } from "@/db/schema";
import { eq } from "drizzle-orm";

import { fetchAndExtractDocument } from "./document";
import { ApiError } from "./errors";
import { recordAttemptIfLoggedIn } from "./history";

import { stripUrlsFromText } from "./_utils/stripUrlsFromText";

type Mode = "word" | "reading";

export type StartSessionResponse = {
  sessionId: string;
  plannedCount: number;
  actualCount: number;
  sourceUrl: string;
  sourceQuoteText: string;
  title: string | null;
  questions: Array<{
    questionId: string;
    prompt: string;
    choices: Array<{ index: number; text: string }>;
    sourceUrl: string;
    sourceQuoteText: string;
  }>;
};

export type SubmitAnswerResponse = {
  isCorrect: boolean;
  explanation: string;
  sourceUrl: string;
  sourceQuoteText: string;
};

type QuestionRecord = {
  questionId: string;
  sessionId: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  sourceUrl: string;
  sourceQuoteText: string;
};

type SessionRecord = {
  sessionId: string;
  inputUrl: string;
  mode: Mode;
  plannedCount: number;
  actualCount: number;
  sourceUrl: string;
  sourceQuoteText: string;
  title: string | null;
  questions: QuestionRecord[];
};

const STRUCTURED_OUTPUTS_MODEL = "gpt-5-mini";

const PLANNED_QUESTION_COUNT = 5;

const inMemorySessions = new Map<string, SessionRecord>();
const inMemoryQuestions = new Map<string, QuestionRecord>();

function getOptionalDbFromBindings(bindings: unknown) {
  const env = bindings as { DB?: D1Database } | null | undefined;
  const db = env?.DB;
  if (!db) return null;
  return createDb(db);
}

async function persistSessionIfPossible(
  db: ReturnType<typeof createDb> | null,
  session: SessionRecord,
): Promise<void> {
  if (!db) return;

  const now = new Date();

  await db.insert(studySessions).values({
    sessionId: session.sessionId,
    userId: null,
    inputUrl: session.inputUrl,
    sourceUrl: session.sourceUrl,
    sourceQuoteText: session.sourceQuoteText,
    title: session.title,
    fetchedAt: now,
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
      sourceUrl: q.sourceUrl,
      sourceQuoteText: q.sourceQuoteText,
      createdAt: now,
    })),
  );
}

async function getQuestionIfPossible(
  db: ReturnType<typeof createDb> | null,
  questionId: string,
): Promise<QuestionRecord | null> {
  const cached = inMemoryQuestions.get(questionId);
  if (cached) return cached;
  if (!db) return null;

  const rows = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.questionId, questionId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const choices = JSON.parse(row.choicesJson) as string[];

  return {
    questionId: row.questionId,
    sessionId: row.sessionId,
    prompt: row.prompt,
    choices,
    correctIndex: row.correctIndex,
    explanation: row.explanation,
    sourceUrl: row.sourceUrl,
    sourceQuoteText: row.sourceQuoteText,
  };
}

function assertMode(mode: unknown): Mode {
  if (mode === "word" || mode === "reading") return mode;
  throw new ApiError("BAD_REQUEST", 400, "mode が不正です");
}

export function getSessionSnapshot(sessionId: string): SessionRecord | null {
  return inMemorySessions.get(sessionId) ?? null;
}

function getSentencesFromMarkdown(markdown: string): string[] {
  const cleaned = markdown
    .replace(/<[^>]+>/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]+`/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return [];

  return cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

type GeneratedQuizItem = {
  prompt: string;
  choices: string[];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
};

async function generateQuizItemsFromText(
  text: string,
  mode: Mode,
  sourceUrl: string,
  sourceTitle: string | null,
): Promise<GeneratedQuizItem[]> {
  const trimmed = text.trim();
  if (!trimmed) return [];

  console.log("[quiz] generating quiz items, text =  ", { trimmed: trimmed });

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
      .max(PLANNED_QUESTION_COUNT),
  });

  const base =
    "あなたは『英語と技術の両方を学べるプログラマー向け英語学習サイト』のクイズ作成者です。\n" +
    "英語学習サイトであるため、出題内容は技術知識を前提とせず、英文を読むことで解ける内容にしてください。\n" +
    "扱う文章は技術ドキュメント（APIドキュメント/仕様/README/設計書など）です。\n" +
    `Source: ${sourceUrl}\n` +
    `Title: ${sourceTitle ?? ""}\n` +
    "共通要件（厳守）:\n" +
    "- 基本は5問作る。ただし入力テキストが短く、5問を自然に作ることが難しい場合は 1〜4問でもよい。\n" +
    "- prompt(問題文), choices(選択肢), explanation(解説)はすべて日本語。\n" +
    "- choices は必ず4つ。正解は correctIndex(0-3) で示す。\n" +
    "- 選択肢は『よくある誤読/別の語義/似た概念』など、学習価値がある紛らわしさにする（ただし重複や同義反復は避ける）。\n" +
    "- 解説は1文で簡潔に。\n";

  const modeSpecific =
    mode === "word"
      ? "word モード要件（厳守）:\n" +
        "- 入力された英文内の重要な英単語/英語フレーズを1つ選び、『日本語の意味』を4択で問う。\n" +
        "- prompt には対象の英単語/英語フレーズと、短い英文の例（前後の文脈が分かる程度）を含める。\n"
      : "reading モード要件（厳守）:\n" +
        "- 各問題は、入力テキストから連続した『英文3〜5文程度』を抜粋し、その内容を理解しているかを4択で問う。\n" +
        "- prompt には抜粋した英文（3〜5文）を必ず含め、その後に日本語で1つ質問を書く（例: 『本文の内容として正しいものはどれ？』）。\n" +
        "- choices は本文の内容理解を問う日本語の選択肢にする（単なる逐語訳の4択にはしない）。\n";

  const prompt = base + modeSpecific + "\n" + "入力テキスト:\n" + trimmed;

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

export async function startQuizSession(
  input: { url: string; mode: Mode },
  bindings?: unknown,
): Promise<StartSessionResponse> {
  const extracted = await fetchAndExtractDocument(input.url);
  const plannedCount = PLANNED_QUESTION_COUNT;
  const text = stripUrlsFromText(getSentencesFromMarkdown(extracted.markdown).join("\n"));
  if (!text.trim()) {
    throw new ApiError(
      "UPSTREAM_PARSE_FAILED",
      502,
      "本文から問題を作れませんでした。別のURLで試してください。",
    );
  }

  const sessionId = crypto.randomUUID();

  const generated = await generateQuizItemsFromText(
    text,
    input.mode,
    extracted.sourceUrl,
    extracted.title,
  );

  const actualCount = generated.length;
  if (actualCount <= 0) {
    throw new ApiError("INTERNAL", 500, "問題の生成に失敗しました");
  }

  const questions: QuestionRecord[] = generated.map((item) => ({
    questionId: crypto.randomUUID(),
    sessionId,
    prompt: item.prompt,
    choices: item.choices as [string, string, string, string],
    correctIndex: item.correctIndex,
    explanation: item.explanation,
    sourceUrl: extracted.sourceUrl,
    sourceQuoteText: extracted.sourceQuoteText,
  }));

  const session: SessionRecord = {
    sessionId,
    inputUrl: input.url.trim(),
    mode: input.mode,
    plannedCount,
    actualCount,
    sourceUrl: extracted.sourceUrl,
    sourceQuoteText: extracted.sourceQuoteText,
    title: extracted.title,
    questions,
  };

  inMemorySessions.set(sessionId, session);
  for (const q of questions) inMemoryQuestions.set(q.questionId, q);

  const db = getOptionalDbFromBindings(bindings);
  await persistSessionIfPossible(db, session);

  return {
    sessionId,
    plannedCount,
    actualCount,
    sourceUrl: session.sourceUrl,
    sourceQuoteText: session.sourceQuoteText,
    title: session.title,
    questions: questions.map((q) => ({
      questionId: q.questionId,
      prompt: q.prompt,
      choices: q.choices.map((text, index) => ({ index, text })),
      sourceUrl: q.sourceUrl,
      sourceQuoteText: q.sourceQuoteText,
    })),
  };
}

export async function submitQuizAnswer(
  input: { sessionId: string; questionId: string; selectedIndex: number },
  bindings?: unknown,
): Promise<SubmitAnswerResponse> {
  const db = getOptionalDbFromBindings(bindings);
  const q = await getQuestionIfPossible(db, input.questionId);
  if (!q || q.sessionId !== input.sessionId) {
    throw new ApiError("BAD_REQUEST", 400, "問題が見つかりませんでした");
  }

  const out = {
    isCorrect: input.selectedIndex === q.correctIndex,
    explanation: q.explanation,
    sourceUrl: q.sourceUrl,
    sourceQuoteText: q.sourceQuoteText,
  };

  await recordAttemptIfLoggedIn(
    {
      sessionId: input.sessionId,
      questionId: input.questionId,
      selectedIndex: input.selectedIndex,
      isCorrect: out.isCorrect,
      explanation: out.explanation,
      answeredAt: new Date(),
    },
    bindings,
  );

  return out;
}

const app = new Hono()
  .post("/answer", async (c) => {
    const body = await c.req.json().catch((): unknown => null);
    if (!body || typeof body !== "object") {
      throw new ApiError("BAD_REQUEST", 400, "リクエストが不正です");
    }

    const record = body as Record<string, unknown>;

    const sessionId = record.sessionId;
    const questionId = record.questionId;
    const selectedIndex = record.selectedIndex;

    if (typeof sessionId !== "string" || typeof questionId !== "string") {
      throw new ApiError("BAD_REQUEST", 400, "リクエストが不正です");
    }
    if (typeof selectedIndex !== "number" || selectedIndex < 0 || selectedIndex > 3) {
      throw new ApiError("BAD_REQUEST", 400, "選択肢が不正です");
    }

    const out = await submitQuizAnswer({ sessionId, questionId, selectedIndex }, c.env);
    return c.json(out);
  })
  .post("/session", async (c) => {
    const body = await c.req.json().catch((): unknown => null);
    if (!body || typeof body !== "object") {
      throw new ApiError("BAD_REQUEST", 400, "リクエストが不正です");
    }

    const record = body as Record<string, unknown>;

    const url = record.url;
    const mode = assertMode(record.mode);
    if (typeof url !== "string") {
      throw new ApiError("BAD_REQUEST", 400, "URL が不正です");
    }

    const out = await startQuizSession({ url, mode }, c.env);
    return c.json(out);
  });

export default app;
