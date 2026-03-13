import { Suspense } from "react";

import { auth } from "@clerk/nextjs/server";

import { getTodayAttemptCount } from "@/server/history/query";
import { getDueReviewCount } from "@/server/review/query";
import { DEFAULT_USER_SETTINGS, getUserSettings } from "@/server/user-settings/query";

import LearnPage from "./_components/LearnPage";
import TopicSuggestions, { TopicSuggestionsFallback } from "./_components/TopicSuggestions";

export default async function LearnIndexPage() {
  const { userId } = await auth();
  const [dueCount, settings, todayCount] = await Promise.all([
    userId ? getDueReviewCount(userId) : Promise.resolve(0),
    userId ? getUserSettings(userId) : Promise.resolve(DEFAULT_USER_SETTINGS),
    userId ? getTodayAttemptCount(userId) : Promise.resolve(0),
  ]);

  return (
    <LearnPage dueCount={dueCount} todayCount={todayCount} dailyGoalCount={settings.dailyGoalCount}>
      <Suspense fallback={<TopicSuggestionsFallback />}>
        <TopicSuggestions />
      </Suspense>
    </LearnPage>
  );
}
