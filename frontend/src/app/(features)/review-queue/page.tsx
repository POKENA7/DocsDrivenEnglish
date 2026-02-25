import { auth } from "@clerk/nextjs/server";

import { getReviewQueue } from "@/server/review/query";
import { retryReviewItemAction } from "./_api/actions";

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// prompt の先頭1行だけ抜き出してラベルとして使う
function extractLabel(prompt: string): string {
  const firstLine = prompt.split("\n")[0] ?? prompt;
  return firstLine.length > 60 ? firstLine.slice(0, 60) + "…" : firstLine;
}

export default async function ReviewQueuePage() {
  const { userId } = await auth();

  if (!userId) {
    return (
      <main className="container-page page">
        <div className="reveal">
          <h1 className="heading-1">復習キュー</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            復習スケジュールを確認するにはログインが必要です。
          </p>
        </div>
      </main>
    );
  }

  const { dueItems, upcomingItems } = await getReviewQueue(userId);
  const total = dueItems.length + upcomingItems.length;

  return (
    <main className="container-page page">
      <div className="reveal">
        <h1 className="heading-1">復習キュー</h1>
        <p className="mt-2 lede">
          {total > 0 ? `${total} 件の復習問題があります` : "復習問題はありません"}
        </p>
      </div>

      {dueItems.length > 0 && (
        <section className="mt-6 reveal" style={{ animationDelay: "80ms" }}>
          <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground">
            ─── 今日出題予定 ({dueItems.length} 件)
          </p>
          <ul className="space-y-2">
            {dueItems.map((item) => (
              <li
                key={item.questionId}
                className="card-compact flex items-start justify-between gap-4"
              >
                <div>
                  <p className="text-sm font-medium">{extractLabel(item.prompt)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    不正解回数: {item.wrongCount}　次回: 今日
                  </p>
                </div>
                <form action={retryReviewItemAction}>
                  <input type="hidden" name="questionId" value={item.questionId} />
                  <button type="submit" className="btn-secondary shrink-0 text-xs">
                    再度解く
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {upcomingItems.length > 0 && (
        <section className="mt-6 reveal" style={{ animationDelay: "140ms" }}>
          <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground">
            ─── 今後の予定 ({upcomingItems.length} 件)
          </p>
          <ul className="space-y-2">
            {upcomingItems.map((item) => (
              <li
                key={item.questionId}
                className="card-compact flex items-start justify-between gap-4"
              >
                <div>
                  <p className="text-sm font-medium">{extractLabel(item.prompt)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    不正解回数: {item.wrongCount}　次回: {formatDate(item.nextReviewAt)}
                  </p>
                </div>
                <form action={retryReviewItemAction}>
                  <input type="hidden" name="questionId" value={item.questionId} />
                  <button type="submit" className="btn-secondary shrink-0 text-xs">
                    再度解く
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {total === 0 && (
        <p className="mt-6 reveal text-sm text-muted-foreground" style={{ animationDelay: "80ms" }}>
          間違えた問題が自動的にここに追加されます。
        </p>
      )}
    </main>
  );
}
