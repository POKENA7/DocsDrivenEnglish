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
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-xl font-semibold tracking-tight">セッション完了</h1>

      <p className="mt-4 text-sm text-muted-foreground">
        このセッションの問題をすべて回答しました。
      </p>

      {props.inputUrl && props.mode ? (
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <input type="hidden" name="url" value={props.inputUrl} />
          <input type="hidden" name="mode" value={props.mode} />

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <button
            type="submit"
            disabled={mutation.isMutating}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {mutation.isMutating ? "開始中..." : "続行（次の10問）"}
          </button>
        </form>
      ) : (
        <div className="mt-6">
          <Link className="text-sm underline" href="/learn">
            /learn へ戻る
          </Link>
        </div>
      )}
    </main>
  );
}
