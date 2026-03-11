import "server-only";

import { getDb } from "@/db/client";
import { userSettings as userSettingsTable } from "@/db/schema";
import { eq } from "drizzle-orm";

type UserSettings = {
  dailyGoalCount: number;
  dailyReviewCount: number;
};

const DEFAULT_SETTINGS: UserSettings = {
  dailyGoalCount: 10,
  dailyReviewCount: 2,
};

export async function getUserSettings(userId: string): Promise<UserSettings> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(userSettingsTable)
    .where(eq(userSettingsTable.userId, userId))
    .limit(1);

  if (!row) return DEFAULT_SETTINGS;

  return {
    dailyGoalCount: row.dailyGoalCount,
    dailyReviewCount: row.dailyReviewCount,
  };
}
