"use client";

import { useActionState, useState } from "react";

import { startSessionFormAction, startSharedSessionFormAction } from "../_api/actions";

import QuizFormFields from "./QuizFormFields";
import SubmitButton from "./SubmitButton";

type Tab = "ai" | "shared";

export default function LearnPage({ dueCount }: { dueCount: number }) {
  const [tab, setTab] = useState<Tab>("ai");
  const [questionCount, setQuestionCount] = useState(10);
  const [reviewQuestionCount, setReviewQuestionCount] = useState(2);
  const [sharedState, sharedAction] = useActionState(startSharedSessionFormAction, {
    error: null,
  });

  return (
    <main className="container-page page">
      <div className="reveal">
        <h1 className="heading-1">学習を開始</h1>
        <p className="mt-2 lede">学習したい技術要素を入力して、クイズを生成します。</p>
      </div>

      {dueCount > 0 && (
        <div
          className="reveal mt-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm"
          role="status"
          style={{ animationDelay: "40ms" }}
        >
          <span aria-hidden="true">📚</span> 復習問題が {dueCount} 件あります —
          今日の学習に自動で含まれます
        </div>
      )}

      {/* タブ切り替え */}
      <div
        className="reveal mt-6 flex gap-1 rounded-lg bg-muted p-1"
        role="tablist"
        style={{ animationDelay: "60ms" }}
      >
        <button
          role="tab"
          aria-selected={tab === "ai"}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "ai"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setTab("ai")}
          type="button"
        >
          AI 生成
        </button>
        <button
          role="tab"
          aria-selected={tab === "shared"}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "shared"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setTab("shared")}
          type="button"
        >
          他のユーザーのクイズ
        </button>
      </div>

      {/* AI 生成タブ */}
      {tab === "ai" && (
        <form action={startSessionFormAction} className="mt-4 space-y-6">
          <section className="card reveal" style={{ animationDelay: "80ms" }}>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="topic">
                学習したい技術・トピック
              </label>
              <input
                id="topic"
                name="topic"
                type="text"
                required
                placeholder="React Hooks"
                className="input"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                例: useEffect, Android Jetpack Compose, Kubernetes Pod
              </p>
            </div>

            <QuizFormFields
              questionCount={questionCount}
              reviewQuestionCount={reviewQuestionCount}
              onQuestionCountChange={setQuestionCount}
              onReviewQuestionCountChange={setReviewQuestionCount}
            />

            <div className="mt-6 flex items-center gap-3">
              <SubmitButton />
              <p className="text-xs text-muted-foreground">{questionCount}問のクイズが始まります</p>
            </div>
          </section>
        </form>
      )}

      {/* 他のユーザーのクイズタブ */}
      {tab === "shared" && (
        <form action={sharedAction} className="mt-4 space-y-6">
          <section className="card reveal" style={{ animationDelay: "80ms" }}>
            <p className="text-sm text-muted-foreground">
              他のユーザーが AI
              生成したクイズをランダムに出題します。トピックはランダムに選ばれます。
            </p>

            {sharedState.error && (
              <div
                className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
                role="alert"
              >
                {sharedState.error}
              </div>
            )}

            <QuizFormFields
              questionCount={questionCount}
              reviewQuestionCount={reviewQuestionCount}
              onQuestionCountChange={setQuestionCount}
              onReviewQuestionCountChange={setReviewQuestionCount}
            />

            <div className="mt-6">
              <SubmitButton />
            </div>
          </section>
        </form>
      )}
    </main>
  );
}
