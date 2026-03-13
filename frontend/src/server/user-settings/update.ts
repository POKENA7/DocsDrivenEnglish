import "server-only";

import { getDb } from "@/db/client";
import { userSettings as userSettingsTable } from "@/db/schema";

export async function upsertUserSettings(
  userId: string,
  settings: { dailyGoalCount: number; dailyReviewCount: number },
): Promise<void> {
  const db = getDb();
  await db
    .insert(userSettingsTable)
    .values({ userId, ...settings })
    .onConflictDoUpdate({
      target: userSettingsTable.userId,
      set: settings,
    });
}
