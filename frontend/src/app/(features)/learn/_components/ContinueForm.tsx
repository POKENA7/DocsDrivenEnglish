"use client";

import { useActionState } from "react";
import Link from "next/link";

import { continueSessionFormAction } from "../_api/actions";
import ContinueButton from "./ContinueButton";

export default function ContinueForm({ topic, mode }: { topic: string; mode: string }) {
  const [state, action] = useActionState(continueSessionFormAction, { error: null });

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="topic" value={topic} />
      <input type="hidden" name="mode" value={mode} />
      {state.error && (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {state.error}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <ContinueButton />
        <Link href="/learn" className="btn btn-ghost">
          別のトピックへ
        </Link>
      </div>
    </form>
  );
}
