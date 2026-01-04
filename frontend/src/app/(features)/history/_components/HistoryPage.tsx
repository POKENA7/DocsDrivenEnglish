"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type HistorySummary = {
  attemptCount: number;
  correctRate: number;
  studyDays: number;
};

export default function HistoryPage() {
  const [status, setStatus] = useState<"loading" | "authed" | "unauthed" | "error">("loading");
  const [summary, setSummary] = useState<HistorySummary | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/history/summary", { method: "GET" });

        if (cancelled) return;

        if (res.status === 401) {
          setStatus("unauthed");
          return;
        }

        if (!res.ok) {
          setStatus("error");
          return;
        }

        const json = (await res.json()) as HistorySummary;
        setSummary(json);
        setStatus("authed");
      } catch {
        if (cancelled) return;
        setStatus("error");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "loading") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-xl font-semibold tracking-tight">履歴</h1>
        <p className="mt-4 text-sm text-muted-foreground">読み込み中...</p>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-xl font-semibold tracking-tight">履歴</h1>
        <p className="mt-4 text-sm text-muted-foreground">取得に失敗しました。</p>
      </main>
    );
  }

  if (status === "unauthed") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-xl font-semibold tracking-tight">履歴</h1>

        <p className="mt-4 text-sm text-muted-foreground">
          未ログインのため、学習履歴は永続化されません。
        </p>

        <div className="mt-6">
          <Link className="text-sm underline" href="/sign-in">
            login
          </Link>
        </div>
      </main>
    );
  }

  const correctRatePercent = summary ? Math.round(summary.correctRate * 100) : 0;

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-xl font-semibold tracking-tight">履歴</h1>

      <div className="mt-6 grid gap-2">
        <div className="text-sm">
          問題数: <span className="font-medium">{summary?.attemptCount ?? 0}</span>
        </div>
        <div className="text-sm">
          正答率: <span className="font-medium">{correctRatePercent}%</span>
        </div>
        <div className="text-sm">
          継続学習日数: <span className="font-medium">{summary?.studyDays ?? 0}</span>
        </div>
      </div>
    </main>
  );
}
