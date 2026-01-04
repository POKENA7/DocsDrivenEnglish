import "server-only";

import type { D1Database } from "@cloudflare/workers-types";

import { Hono } from "hono";

import { createOpenAIResponse } from "@/lib/openaiClient";

import { createDb } from "@/db/client";
import { questions as questionsTable, studySessions } from "@/db/schema";
import { eq } from "drizzle-orm";

import { fetchAndExtractDocument } from "./document";
import { ApiError } from "./errors";
import { recordAttemptIfLoggedIn } from "./history";

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

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "if",
  "then",
  "else",
  "for",
  "to",
  "of",
  "in",
  "on",
  "at",
  "by",
  "with",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "you",
  "your",
  "we",
  "our",
  "they",
  "their",
  "i",
  "me",
  "my",
]);

function assertMode(mode: unknown): Mode {
  if (mode === "word" || mode === "reading") return mode;
  throw new ApiError("BAD_REQUEST", 400, "Invalid mode");
}

export function getSessionSnapshot(sessionId: string): SessionRecord | null {
  return inMemorySessions.get(sessionId) ?? null;
}

function pickCandidateWords(markdown: string): string[] {
  const words = markdown
    .toLowerCase()
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4)
    .filter((w) => /^[a-z][a-z0-9-]*$/.test(w))
    .filter((w) => !STOPWORDS.has(w));

  const uniq: string[] = [];
  const seen = new Set<string>();
  for (const w of words) {
    if (seen.has(w)) continue;
    seen.add(w);
    uniq.push(w);
    if (uniq.length >= 50) break;
  }
  return uniq;
}

function buildClozePrompt(markdown: string, target: string): string {
  const sentences = markdown
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim());

  const hit = sentences.find((s) => s.toLowerCase().includes(target.toLowerCase()));
  if (!hit) {
    return `Choose the best word: ____ (${target})`;
  }

  const replaced = hit.replace(new RegExp(`\\b${target}\\b`, "i"), "____");
  return replaced;
}

function pickChoices(
  candidates: string[],
  correct: string,
): { choices: string[]; correctIndex: number } {
  const pool = candidates.filter((w) => w !== correct);
  const distractors: string[] = [];
  for (const w of pool) {
    distractors.push(w);
    if (distractors.length >= 3) break;
  }

  const choices = [correct, ...distractors].slice(0, 4);
  while (choices.length < 4) choices.push(correct);

  return { choices, correctIndex: 0 };
}

async function generateExplanation(word: string, mode: Mode, sourceUrl: string): Promise<string> {
  const prompt =
    `Explain the English term or phrase: ${word}\n` +
    `Mode: ${mode}\n` +
    `Include: meaning, technical background, and typical usage scenario.\n` +
    `Source: ${sourceUrl}`;

  const res = (await createOpenAIResponse(prompt, "gpt-4.1-mini")) as unknown;
  if (!res || typeof res !== "object") return "";

  const record = res as Record<string, unknown>;
  const outputText = record.output_text;
  if (typeof outputText !== "string") return "";

  return outputText.trim();
}

export async function startQuizSession(
  input: { url: string; mode: Mode },
  bindings?: unknown,
): Promise<StartSessionResponse> {
  const extracted = await fetchAndExtractDocument(input.url);
  const candidates = pickCandidateWords(extracted.markdown);
  const plannedCount = 10;
  const actualCount = Math.min(plannedCount, candidates.length);
  if (actualCount <= 0) {
    throw new ApiError("UPSTREAM_PARSE_FAILED", 502, "Not enough content");
  }

  const sessionId = crypto.randomUUID();

  const questions: QuestionRecord[] = await Promise.all(
    candidates.slice(0, actualCount).map(async (word) => {
      const { choices, correctIndex } = pickChoices(candidates, word);
      const prompt =
        input.mode === "reading"
          ? buildClozePrompt(extracted.markdown, word)
          : `Choose the correct term: ${word}`;

      const explanation = await generateExplanation(word, input.mode, extracted.sourceUrl);

      return {
        questionId: crypto.randomUUID(),
        sessionId,
        prompt,
        choices,
        correctIndex,
        explanation,
        sourceUrl: extracted.sourceUrl,
        sourceQuoteText: extracted.sourceQuoteText,
      };
    }),
  );

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
    throw new ApiError("BAD_REQUEST", 400, "Question not found");
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
      throw new ApiError("BAD_REQUEST", 400, "Invalid body");
    }

    const record = body as Record<string, unknown>;

    const sessionId = record.sessionId;
    const questionId = record.questionId;
    const selectedIndex = record.selectedIndex;

    if (typeof sessionId !== "string" || typeof questionId !== "string") {
      throw new ApiError("BAD_REQUEST", 400, "Invalid input");
    }
    if (typeof selectedIndex !== "number" || selectedIndex < 0 || selectedIndex > 3) {
      throw new ApiError("BAD_REQUEST", 400, "Invalid selectedIndex");
    }

    const out = await submitQuizAnswer({ sessionId, questionId, selectedIndex }, c.env);
    return c.json(out);
  })
  .post("/session", async (c) => {
    const body = await c.req.json().catch((): unknown => null);
    if (!body || typeof body !== "object") {
      throw new ApiError("BAD_REQUEST", 400, "Invalid body");
    }

    const record = body as Record<string, unknown>;

    const url = record.url;
    const mode = assertMode(record.mode);
    if (typeof url !== "string") {
      throw new ApiError("BAD_REQUEST", 400, "Invalid url");
    }

    const out = await startQuizSession({ url, mode }, c.env);
    return c.json(out);
  });

export default app;
