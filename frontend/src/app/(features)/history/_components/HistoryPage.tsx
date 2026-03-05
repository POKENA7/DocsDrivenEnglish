import { requireUserId } from "@/lib/auth";
import { getDailyAttemptCountsQuery, getHistorySummaryQuery } from "@/server/history/query";

import StudyCalendar from "./StudyCalendar";

export default async function HistoryPage() {
  const userId = await requireUserId();
  const [summary, dailyCounts] = await Promise.all([
    getHistorySummaryQuery(userId),
    getDailyAttemptCountsQuery(userId),
  ]);

  const correctRatePercent = Math.round(summary.correctRate * 100);

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

      <section className="mt-6">
        <StudyCalendar allCounts={dailyCounts} />
      </section>
    </main>
  );
}
