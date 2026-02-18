import Link from "next/link";

import { continueSessionFormAction } from "../_api/actions";

import ContinueButton from "./ContinueButton";

export default function SessionCompletePage(props: {
  sessionId: string;
  topic: string | null;
  mode: "word" | "reading" | null;
}) {
  return (
    <main className="container-page page">
      <div className="reveal">
        <h1 className="heading-1">セッション完了</h1>
        <p className="mt-2 lede">このセッションの問題をすべて回答しました。</p>
      </div>

      <section className="mt-6 card reveal" style={{ animationDelay: "80ms" }}>
        {props.topic && props.mode ? (
          <form action={continueSessionFormAction} className="space-y-4">
            <input type="hidden" name="topic" value={props.topic} />
            <input type="hidden" name="mode" value={props.mode} />

            <div className="flex flex-wrap items-center gap-3">
              <ContinueButton />
              <Link href="/learn" className="btn btn-ghost">
                別のトピックで学習
              </Link>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              トピックまたは Mode が見つかりませんでした。
            </p>
            <Link className="btn btn-primary w-fit" href="/learn">
              /learn へ戻る
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
