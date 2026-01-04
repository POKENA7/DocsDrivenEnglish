"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWRMutation from "swr/mutation";

import { continueSessionAction } from "../_api/actions";

export default function SessionCompletePage(props: {
  sessionId: string;
  inputUrl: string | null;
  mode: "word" | "reading" | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const mutation = useSWRMutation(
    "quiz/session",
    async (_key, { arg }: { arg: { url: string; mode: "word" | "reading" } }) => {
      return continueSessionAction(arg);
    },
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!props.inputUrl || !props.mode) return;

    setError(null);
    try {
      const session = await mutation.trigger({ url: props.inputUrl, mode: props.mode });
      router.push(`/session/${session.sessionId}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "エラーが発生しました";
      setError(message);
    }
  }

  return (
    <main className="container-page page">
      <div className="reveal">
        <h1 className="heading-1">セッション完了</h1>
        <p className="mt-2 lede">このセッションの問題をすべて回答しました。</p>
      </div>

      <section className="mt-6 card reveal" style={{ animationDelay: "80ms" }}>
        {props.inputUrl && props.mode ? (
          <form onSubmit={onSubmit} className="space-y-4">
            <input type="hidden" name="url" value={props.inputUrl} />
            <input type="hidden" name="mode" value={props.mode} />

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" disabled={mutation.isMutating} className="btn btn-primary">
                {mutation.isMutating ? "開始中..." : "続行（次の5問）"}
              </button>
              <Link href="/learn" className="btn btn-ghost">
                別のURLで学習
              </Link>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              URL または Mode が見つかりませんでした。
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
