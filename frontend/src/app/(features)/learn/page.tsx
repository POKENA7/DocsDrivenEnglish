import { Suspense } from "react";

import { auth } from "@clerk/nextjs/server";

import { getDueReviewCount } from "@/server/review/query";
import { getUserSettings } from "@/server/user-settings/query";
import { getTodayAttemptCount } from "@/server/history/query";

import LearnPage from "./_components/LearnPage";
import TopicSuggestions, { TopicSuggestionsFallback } from "./_components/TopicSuggestions";

export default async function LearnIndexPage() {
  const { userId } = await auth();
  const [dueCount, settings, todayCount] = await Promise.all([
    userId ? getDueReviewCount(userId) : Promise.resolve(0),
    userId ? getUserSettings(userId) : Promise.resolve({ dailyGoalCount: 10, dailyReviewCount: 2 }),
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
