"use client";

import { useActionState } from "react";

import { startSessionAction } from "../_api/actions";

export default function LearnPage() {
  const [state, action, pending] = useActionState(startSessionAction, {
    error: null,
  });

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-xl font-semibold tracking-tight">学習を開始</h1>

      <form action={action} className="mt-6 space-y-6">
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
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Mode</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="mode" value="word" defaultChecked />
            word
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="mode" value="reading" />
            reading
          </label>
        </fieldset>

        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? "開始中..." : "学習開始"}
        </button>
      </form>
    </main>
  );
}
