import SessionCompletePage from "../../_components/SessionCompletePage";

import { getSessionResult } from "@/server/quiz/query";
import { auth } from "@clerk/nextjs/server";
import { getUserSettings } from "@/server/user-settings/query";
import { getTodayAttemptCount } from "@/server/history/query";

type Params = {
  sessionId: string;
};

type PageProps = {
  params: Promise<Params>;
};

export default async function LearnSessionComplete({ params }: PageProps) {
  const { sessionId } = await params;
  const { userId } = await auth();

  const [result, settings, todayCount] = await Promise.all([
    getSessionResult(sessionId),
    userId ? getUserSettings(userId) : Promise.resolve({ dailyGoalCount: 10, dailyReviewCount: 2 }),
    userId ? getTodayAttemptCount(userId) : Promise.resolve(0),
  ]);

  const isGoalAchieved = todayCount >= settings.dailyGoalCount;

  return <SessionCompletePage result={result} isGoalAchieved={isGoalAchieved} />;
}
