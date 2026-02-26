import Link from "next/link";

import type { Mode } from "@/server/quiz/types";
import { continueSessionFormAction } from "../_api/actions";

import ContinueButton from "./ContinueButton";

export default function SessionCompletePage(props: {
  sessionId: string;
  topic: string;
  mode: Mode;
}) {
  return (
    <main className="container-page page">
      <div className="reveal">
        <h1 className="heading-1">セッション完了</h1>
        <p className="mt-2 lede">このセッションの問題をすべて回答しました。</p>
      </div>

      <section className="mt-6 card reveal" style={{ animationDelay: "80ms" }}>
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
      </section>
    </main>
  );
}
