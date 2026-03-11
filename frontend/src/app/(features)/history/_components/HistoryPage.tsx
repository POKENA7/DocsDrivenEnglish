import { requireUserId } from "@/lib/auth";
import {
  getDailyAttemptCountsQuery,
  getHistorySummaryQuery,
  getTodayAttemptCount,
} from "@/server/history/query";
import { getUserSettings } from "@/server/user-settings/query";

import StudyCalendar from "./StudyCalendar";
import GoalSettingsForm from "./GoalSettingsForm";

export default async function HistoryPage() {
  const userId = await requireUserId();
  const [summary, dailyCounts, todayCount, settings] = await Promise.all([
    getHistorySummaryQuery(userId),
    getDailyAttemptCountsQuery(userId),
    getTodayAttemptCount(userId),
    getUserSettings(userId),
  ]);

  const correctRatePercent = Math.round(summary.correctRate * 100);
  const isGoalAchieved = todayCount >= settings.dailyGoalCount;

  return (
    <main className="container-page page">
      <div className="reveal">
        <h1 className="heading-1">履歴</h1>
        <p className="mt-2 lede">あなたの学習のサマリーです。</p>
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="card-compact reveal" style={{ animationDelay: "80ms" }}>
          <p className="text-xs text-muted-foreground">問題数</p>
          <p className="mt-1 text-lg font-semibold tracking-tight">{summary.attemptCount}</p>
        </div>
        <div className="card-compact reveal" style={{ animationDelay: "140ms" }}>
          <p className="text-xs text-muted-foreground">正答率</p>
          <p className="mt-1 text-lg font-semibold tracking-tight">{correctRatePercent}%</p>
        </div>
        <div className="card-compact reveal" style={{ animationDelay: "200ms" }}>
          <p className="text-xs text-muted-foreground">継続学習日数</p>
          <p className="mt-1 text-lg font-semibold tracking-tight">{summary.studyDays}</p>
        </div>
      </section>

      <section className="mt-6 card reveal" style={{ animationDelay: "260ms" }}>
        <h2 className="text-sm font-semibold">今日の達成状況</h2>
        {isGoalAchieved ? (
          <p className="mt-2 text-sm">
            🎉 目標達成！（{todayCount} / {settings.dailyGoalCount} 問）
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            {todayCount} / {settings.dailyGoalCount} 問（残り {settings.dailyGoalCount - todayCount}{" "}
            問）
          </p>
        )}
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{
              width: `${Math.min(100, Math.round((todayCount / settings.dailyGoalCount) * 100))}%`,
            }}
          />
        </div>
      </section>

      <section className="mt-6">
        <StudyCalendar allCounts={dailyCounts} />
      </section>

      <section className="mt-6 card reveal" style={{ animationDelay: "320ms" }}>
        <h2 className="text-sm font-semibold">学習目標の設定</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          1日の目標問題数と復習問題数を設定します
        </p>
        <GoalSettingsForm
          dailyGoalCount={settings.dailyGoalCount}
          dailyReviewCount={settings.dailyReviewCount}
        />
      </section>
    </main>
  );
}
