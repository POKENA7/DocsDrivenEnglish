"use client";

import { useActionState } from "react";
import Link from "next/link";

import { continueSessionAction } from "../_api/actions";

export default function SessionCompletePage(props: {
  sessionId: string;
  inputUrl: string | null;
  mode: "word" | "reading" | null;
}) {
  const [state, action, pending] = useActionState(continueSessionAction, {
    error: null,
  });

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-xl font-semibold tracking-tight">セッション完了</h1>

      <p className="mt-4 text-sm text-muted-foreground">
        このセッションの問題をすべて回答しました。
      </p>

      {props.inputUrl && props.mode ? (
        <form action={action} className="mt-6 space-y-4">
          <input type="hidden" name="url" value={props.inputUrl} />
          <input type="hidden" name="mode" value={props.mode} />

          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {pending ? "開始中..." : "続行（次の10問）"}
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
