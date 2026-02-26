import Link from "next/link";

export default function MarketingHomePage() {
  return (
    <main className="container-page py-16">
      <div className="reveal">
        <p className="inline-flex items-center rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
          トピック → クイズ → 復習
        </p>

        <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
          DocsDrivenEnglish
        </h1>

        <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted-foreground">
          「React Hooks」「Kubernetes Pod」など、気になる技術トピックを入力するだけ。AI
          が本物の技術ドキュメントさながらの英語クイズをその場で生成します。毎日続けて、技術英語をサクッとモノにしよう。
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
          <h2 className="mt-2 text-sm font-semibold tracking-tight">トピックを入力</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            学びたい技術要素をテキストで入力するだけ。難しい準備は一切なし。
          </p>
        </div>
        <div className="card-compact reveal" style={{ animationDelay: "160ms" }}>
          <p className="text-xs font-medium text-muted-foreground">02</p>
          <h2 className="mt-2 text-sm font-semibold tracking-tight">モードと問題数を設定</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            word / reading
            の2モード＆最大20問から自由にカスタマイズ。他のユーザーのクイズにも挑戦できます。
          </p>
        </div>
        <div className="card-compact reveal" style={{ animationDelay: "240ms" }}>
          <p className="text-xs font-medium text-muted-foreground">03</p>
          <h2 className="mt-2 text-sm font-semibold tracking-tight">解いて・復習して定着</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            丁寧な解説＋「もっと解説」で深掘り。不正解問題は自動で復習キューに登録されるから、忘れた頃にもう一度。
          </p>
        </div>
      </section>
    </main>
  );
}
