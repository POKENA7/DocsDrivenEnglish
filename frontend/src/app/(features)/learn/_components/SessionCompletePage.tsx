import type { SessionResult } from "@/server/quiz/query";
import Link from "next/link";

export default function SessionCompletePage(props: {
  result: SessionResult;
  isGoalAchieved: boolean;
}) {
  const { result, isGoalAchieved } = props;
  const percentage = Math.round((result.correctCount / result.totalCount) * 100);

  return (
    <main className="container-page page">
      <div className="reveal">
        <h1 className="heading-1">セッション完了 🎉</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {result.topic} — {result.mode} モード
        </p>
      </div>

      {isGoalAchieved && (
        <div
          className="reveal mt-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm"
          role="status"
          style={{ animationDelay: "40ms" }}
        >
          🎯 本日の学習目標を達成しました！
        </div>
      )}

      <section className="mt-6 card reveal" style={{ animationDelay: "80ms" }}>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-xs text-muted-foreground">正答数</dt>
            <dd className="mt-1 text-2xl font-bold">
              {result.correctCount} / {result.totalCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">正答率</dt>
            <dd className="mt-1 text-2xl font-bold">{percentage}%</dd>
          </div>
        </dl>
      </section>

      <section className="mt-4 space-y-2 reveal" style={{ animationDelay: "160ms" }}>
        <h2 className="text-sm font-semibold text-muted-foreground">問題ごとの結果</h2>
        {result.items.map((item, i) => (
          <div key={item.questionId} className="card">
            <div className="flex items-start gap-3">
              <span>{item.isCorrect ? "✅" : "❌"}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium line-clamp-2">
                  Q{i + 1}. {item.prompt}
                </p>
                {!item.isCorrect && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    正解: {item.choices[item.correctIndex]}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-6 card reveal" style={{ animationDelay: "240ms" }}>
        <Link href="/learn" className="btn btn-primary">
          トップ に戻る
        </Link>
      </section>
    </main>
  );
}
