import Link from "next/link";

export default function MarketingHomePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">DocsDrivenEnglish</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        公開ドキュメントURL（1ページ）から教材を生成し、最大10問のクイズで学習します。
      </p>
      <div className="mt-8">
        <Link
          href="/learn"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          学習を開始
        </Link>
      </div>
    </main>
  );
}
