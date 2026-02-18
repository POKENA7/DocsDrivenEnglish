import "server-only";

import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";

import { createDb } from "@/db/client";
import { attempts as attemptsTable } from "@/db/schema";
import { getOptionalUserId } from "@/lib/auth";
import { calculateHistorySummary, inMemoryAttemptsByUser } from "@/app/api/[[...route]]/history";

export type HistorySummary = {
  attemptCount: number;
  correctRate: number;
  studyDays: number;
};

export type HistorySummaryResult =
  | { status: "unauthed"; summary: null }
  | { status: "authed"; summary: HistorySummary };

export async function getHistorySummaryQuery(): Promise<HistorySummaryResult> {
  const userId = await getOptionalUserId();
  if (!userId) {
    return { status: "unauthed", summary: null };
  }

  let db: ReturnType<typeof createDb> | null = null;
  try {
    const { env } = getCloudflareContext();
    const d1 = (env as Record<string, unknown>).DB;
    if (d1) db = createDb(d1 as import("@cloudflare/workers-types").D1Database);
  } catch {
    // next dev 環境など、Cloudflare context がない場合
  }

  if (!db) {
    const attempts = inMemoryAttemptsByUser.get(userId) ?? [];
    return { status: "authed", summary: calculateHistorySummary(attempts) };
  }

  const rows = await db
    .select({ answeredAt: attemptsTable.answeredAt, isCorrect: attemptsTable.isCorrect })
    .from(attemptsTable)
    .where(eq(attemptsTable.userId, userId));

  return { status: "authed", summary: calculateHistorySummary(rows) };
}
