import "server-only";

import { cache } from "react";

import { Hono } from "hono";

import { auth } from "@clerk/nextjs/server";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import { createDb } from "@/db/client";
import { questions as questionsTable, reviewQueue } from "@/db/schema";
import { and, count, eq, lte } from "drizzle-orm";

import { ApiError } from "./errors";

function getOptionalDb() {
  try {
    const { env } = getCloudflareContext();
    const db = (env as Record<string, unknown>).DB;
    if (!db) return null;
    return createDb(db as import("@cloudflare/workers-types").D1Database);
  } catch {
    return null;
  }
}

type ReviewQueueItem = {
  questionId: string;
  prompt: string;
  choices: Array<{ index: number; text: string }>;
  answer: number;
  explanation: string;
  nextReviewAt: number;
  wrongCount: number;
};

async function fetchReviewItems(
  userId: string,
  filter: "due" | "all",
): Promise<{ dueItems: ReviewQueueItem[]; upcomingItems: ReviewQueueItem[] }> {
  const db = getOptionalDb();
  if (!db) return { dueItems: [], upcomingItems: [] };

  const nowMs = Date.now();

  const rows = await db
    .select({
      questionId: questionsTable.questionId,
      prompt: questionsTable.prompt,
      choicesJson: questionsTable.choicesJson,
      correctIndex: questionsTable.correctIndex,
      explanation: questionsTable.explanation,
      nextReviewAt: reviewQueue.nextReviewAt,
      wrongCount: reviewQueue.wrongCount,
    })
    .from(reviewQueue)
    .innerJoin(questionsTable, eq(reviewQueue.questionId, questionsTable.questionId))
    .where(
      filter === "due"
        ? and(eq(reviewQueue.userId, userId), lte(reviewQueue.nextReviewAt, nowMs))
        : eq(reviewQueue.userId, userId),
    )
    .orderBy(reviewQueue.nextReviewAt);

  const toItem = (row: (typeof rows)[0]): ReviewQueueItem => ({
    questionId: row.questionId,
    prompt: row.prompt,
    choices: (JSON.parse(row.choicesJson) as string[]).map((text, index) => ({ index, text })),
    answer: row.correctIndex,
    explanation: row.explanation,
    nextReviewAt: row.nextReviewAt,
    wrongCount: row.wrongCount,
  });

  if (filter === "due") {
    return { dueItems: rows.map(toItem), upcomingItems: [] };
  }

  const dueItems = rows.filter((r) => r.nextReviewAt <= nowMs).map(toItem);
  const upcomingItems = rows.filter((r) => r.nextReviewAt > nowMs).map(toItem);
  return { dueItems, upcomingItems };
}

// LearnPage バナー用: 期限切れ復習問題件数（React.cache でリクエスト内重複排除）
export const getDueReviewCount = cache(async (userId: string): Promise<number> => {
  const db = getOptionalDb();
  if (!db) return 0;

  const nowMs = Date.now();
  const [result] = await db
    .select({ count: count() })
    .from(reviewQueue)
    .where(and(eq(reviewQueue.userId, userId), lte(reviewQueue.nextReviewAt, nowMs)));

  return result?.count ?? 0;
});

type ReviewQueueDisplayItem = {
  questionId: string;
  prompt: string;
  nextReviewAt: number;
  wrongCount: number;
};

// ReviewQueuePage 用: due / upcoming 分類して返す
export const getReviewQueue = cache(
  async (
    userId: string,
  ): Promise<{ dueItems: ReviewQueueDisplayItem[]; upcomingItems: ReviewQueueDisplayItem[] }> => {
    const db = getOptionalDb();
    if (!db) return { dueItems: [], upcomingItems: [] };

    const nowMs = Date.now();
    const rows = await db
      .select({
        questionId: questionsTable.questionId,
        prompt: questionsTable.prompt,
        nextReviewAt: reviewQueue.nextReviewAt,
        wrongCount: reviewQueue.wrongCount,
      })
      .from(reviewQueue)
      .innerJoin(questionsTable, eq(reviewQueue.questionId, questionsTable.questionId))
      .where(eq(reviewQueue.userId, userId))
      .orderBy(reviewQueue.nextReviewAt);

    return {
      dueItems: rows.filter((r) => r.nextReviewAt <= nowMs),
      upcomingItems: rows.filter((r) => r.nextReviewAt > nowMs),
    };
  },
);

const app = new Hono()
  // GET /api/review-queue/due — 期限切れ復習問題一覧
  .get("/due", async (c) => {
    const { userId } = await auth();
    if (!userId) throw new ApiError("UNAUTHORIZED", 401, "ログインが必要です");

    const { dueItems } = await fetchReviewItems(userId, "due");
    return c.json({ items: dueItems });
  })
  // GET /api/review-queue — 全件一覧（due / upcoming 分類）
  .get("/", async (c) => {
    const { userId } = await auth();
    if (!userId) throw new ApiError("UNAUTHORIZED", 401, "ログインが必要です");

    const result = await fetchReviewItems(userId, "all");
    return c.json(result);
  });

export default app;
