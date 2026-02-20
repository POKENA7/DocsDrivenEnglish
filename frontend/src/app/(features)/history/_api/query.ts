import "server-only";

import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";

import { createDb } from "@/db/client";
import { attempts as attemptsTable } from "@/db/schema";
import { requireUserId } from "@/lib/auth";

type AttemptRecord = {
  answeredAt: Date;
  isCorrect: boolean;
};

type HistorySummary = {
  attemptCount: number;
  correctRate: number;
  studyDays: number;
};

export function calculateHistorySummary(attempts: AttemptRecord[]): HistorySummary {
  const attemptCount = attempts.length;
  const correctCount = attempts.filter((a) => a.isCorrect).length;
  const correctRate = attemptCount === 0 ? 0 : correctCount / attemptCount;

  const days = new Set<string>();
  for (const a of attempts) {
    const d = new Date(a.answeredAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
    days.add(key);
  }

  return {
    attemptCount,
    correctRate,
    studyDays: days.size,
  };
}

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
