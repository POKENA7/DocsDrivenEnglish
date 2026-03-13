import SessionCompletePage from "../../_components/SessionCompletePage";

import { auth } from "@clerk/nextjs/server";
import { getUserSettings } from "@/server/user-settings/query";
import { getTodayAttemptCount } from "@/server/history/query";
import { getSessionResult } from "@/server/quiz/query";
import { DEFAULT_USER_SETTINGS } from "@/server/user-settings/query";

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
    userId ? getUserSettings(userId) : Promise.resolve(DEFAULT_USER_SETTINGS),
    userId ? getTodayAttemptCount(userId) : Promise.resolve(0),
  ]);

  const isGoalAchieved = todayCount >= settings.dailyGoalCount;

  return <SessionCompletePage result={result} isGoalAchieved={isGoalAchieved} />;
}
