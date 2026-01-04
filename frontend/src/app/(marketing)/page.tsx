import Link from "next/link";

export default function MarketingHomePage() {
  return (
    <main className="container-page py-16">
      <div className="reveal">
        <p className="inline-flex items-center rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
          公開ドキュメント → 教材 → クイズ
        </p>

        <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
          DocsDrivenEnglish
        </h1>

        <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted-foreground">
          URL
          を貼るだけで、1ページ分の公開ドキュメントから問題を生成し、最大5問のクイズで学習します。
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/learn" className="btn btn-primary">
            学習を開始
          </Link>
          <Link href="/history" className="btn btn-ghost">
            履歴を見る
          </Link>
        </div>
      </div>

      <section className="mt-10 grid gap-3 sm:grid-cols-3">
        <div className="card-compact reveal" style={{ animationDelay: "80ms" }}>
          <p className="text-xs font-medium text-muted-foreground">01</p>
          <h2 className="mt-2 text-sm font-semibold tracking-tight">URLを入力</h2>
          <p className="mt-2 text-sm text-muted-foreground">公開ドキュメント（1ページ）を指定。</p>
        </div>
        <div className="card-compact reveal" style={{ animationDelay: "160ms" }}>
          <p className="text-xs font-medium text-muted-foreground">02</p>
          <h2 className="mt-2 text-sm font-semibold tracking-tight">問題を生成</h2>
          <p className="mt-2 text-sm text-muted-foreground">word / reading を選べます。</p>
        </div>
        <div className="card-compact reveal" style={{ animationDelay: "240ms" }}>
          <p className="text-xs font-medium text-muted-foreground">03</p>
          <h2 className="mt-2 text-sm font-semibold tracking-tight">解いて定着</h2>
          <p className="mt-2 text-sm text-muted-foreground">解説と Source を確認できます。</p>
        </div>
      </section>
    </main>
  );
}
