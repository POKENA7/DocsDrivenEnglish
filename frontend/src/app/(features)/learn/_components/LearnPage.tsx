"use client";

import { useLearnStart } from "../_hooks/useLearnStart";

export default function LearnPage() {
  const { onSubmit, pending, error } = useLearnStart();

  return (
    <main className="container-page page">
      <div className="reveal">
        <h1 className="heading-1">学習を開始</h1>
        <p className="mt-2 lede">公開ドキュメントのURLを貼り付けて、クイズを生成します。</p>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-6">
        <section className="card reveal" style={{ animationDelay: "80ms" }}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="url">
              URL
            </label>
            <input
              id="url"
              name="url"
              type="url"
              required
              placeholder="https://..."
              className="input"
              inputMode="url"
              autoComplete="url"
            />
            <p className="text-xs text-muted-foreground">例: ドキュメントの単一ページ（公開URL）</p>
          </div>

          <fieldset className="mt-6">
            <legend className="text-sm font-medium">Mode</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="choice">
                <input className="mt-0.5" type="radio" name="mode" value="word" defaultChecked />
                <span>
                  <span className="block font-medium">word</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    単語・用語の理解を優先
                  </span>
                </span>
              </label>
              <label className="choice">
                <input className="mt-0.5" type="radio" name="mode" value="reading" />
                <span>
                  <span className="block font-medium">reading</span>
                  <span className="mt-1 block text-xs text-muted-foreground">文脈・読解を優先</span>
                </span>
              </label>
            </div>
          </fieldset>

          {error ? <p className="mt-5 text-sm text-destructive">{error}</p> : null}

          <div className="mt-6 flex items-center gap-3">
            <button type="submit" disabled={pending} className="btn btn-primary">
              {pending ? "開始中..." : "学習開始"}
            </button>
            <p className="text-xs text-muted-foreground">最大10問のクイズが始まります</p>
          </div>
        </section>
      </form>
    </main>
  );
}
