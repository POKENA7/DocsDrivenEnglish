"use client";

import Link from "next/link";

import { useHistorySummary } from "../_hooks/useHistorySummary";

export default function HistoryPage() {
  const { status, summary } = useHistorySummary();

  if (status === "loading") {
    return (
      <main className="container-page page">
        <h1 className="heading-1">履歴</h1>
        <p className="mt-3 lede">読み込み中...</p>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="container-page page">
        <h1 className="heading-1">履歴</h1>
        <section className="mt-6 card">
          <p className="text-sm text-muted-foreground">取得に失敗しました。</p>
        </section>
      </main>
    );
  }

  if (status === "unauthed") {
    return (
      <main className="container-page page">
        <h1 className="heading-1">履歴</h1>

        <section className="mt-6 card">
          <p className="text-sm text-muted-foreground">
            未ログインのため、学習履歴は永続化されません。
          </p>
          <div className="mt-5 flex items-center gap-3">
            <Link className="btn btn-primary" href="/sign-in">
              login
            </Link>
            <Link className="btn btn-ghost" href="/learn">
              学習へ戻る
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const correctRatePercent = summary ? Math.round(summary.correctRate * 100) : 0;

  return (
    <main className="container-page page">
      <div className="reveal">
        <h1 className="heading-1">履歴</h1>
        <p className="mt-2 lede">あなたの学習のサマリーです。</p>
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="card-compact reveal" style={{ animationDelay: "80ms" }}>
          <p className="text-xs text-muted-foreground">問題数</p>
          <p className="mt-1 text-lg font-semibold tracking-tight">{summary?.attemptCount ?? 0}</p>
        </div>
        <div className="card-compact reveal" style={{ animationDelay: "140ms" }}>
          <p className="text-xs text-muted-foreground">正答率</p>
          <p className="mt-1 text-lg font-semibold tracking-tight">{correctRatePercent}%</p>
        </div>
        <div className="card-compact reveal" style={{ animationDelay: "200ms" }}>
          <p className="text-xs text-muted-foreground">継続学習日数</p>
          <p className="mt-1 text-lg font-semibold tracking-tight">{summary?.studyDays ?? 0}</p>
        </div>
      </section>
    </main>
  );
}
