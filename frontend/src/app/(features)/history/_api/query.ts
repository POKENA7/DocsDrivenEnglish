import "server-only";

import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";

import { createDb } from "@/db/client";
import { attempts as attemptsTable } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { calculateHistorySummary } from "@/app/api/[[...route]]/history";

type HistorySummary = {
  attemptCount: number;
  correctRate: number;
  studyDays: number;
};

export async function getHistorySummaryQuery(): Promise<HistorySummary> {
  const userId = await requireUserId();

  let db: ReturnType<typeof createDb> | null = null;
  try {
    const { env } = getCloudflareContext();
    const d1 = (env as Record<string, unknown>).DB;
    if (d1) db = createDb(d1 as import("@cloudflare/workers-types").D1Database);
  } catch {
    // next dev 環境など、Cloudflare context がない場合
  }

  if (!db) {
    return calculateHistorySummary([]);
  }

  const rows = await db
    .select({ answeredAt: attemptsTable.answeredAt, isCorrect: attemptsTable.isCorrect })
    .from(attemptsTable)
    .where(eq(attemptsTable.userId, userId));

  return calculateHistorySummary(rows);
}
