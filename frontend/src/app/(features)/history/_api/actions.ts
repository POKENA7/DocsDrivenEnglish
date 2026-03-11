"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUserId } from "@/lib/auth";
import { upsertUserSettings } from "@/server/user-settings/update";

const updateSettingsInput = z.object({
  dailyGoalCount: z.coerce.number().int().min(1).max(20).catch(10),
  dailyReviewCount: z.coerce.number().int().min(0).catch(2),
});

export async function updateUserSettingsAction(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const parsed = updateSettingsInput.parse({
    dailyGoalCount: formData.get("dailyGoalCount") ?? 10,
    dailyReviewCount: formData.get("dailyReviewCount") ?? 2,
  });

  const userId = await requireUserId();
  const dailyReviewCount = Math.min(parsed.dailyReviewCount, parsed.dailyGoalCount - 1);
  await upsertUserSettings(userId, { dailyGoalCount: parsed.dailyGoalCount, dailyReviewCount });
  revalidatePath("/history");
  revalidatePath("/learn");

  return { error: null };
}
