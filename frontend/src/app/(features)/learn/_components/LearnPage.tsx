"use client";

import { useState } from "react";

import { startSessionFormAction } from "../_api/actions";

import SubmitButton from "./SubmitButton";

export default function LearnPage({ dueCount }: { dueCount: number }) {
  const [questionCount, setQuestionCount] = useState(10);
  const [reviewQuestionCount, setReviewQuestionCount] = useState(2);

  function handleQuestionCountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = Math.max(1, Math.min(20, Number(e.target.value) || 1));
    setQuestionCount(val);
    // 出題問題数を下回っていたら上限に丸める（少なくとも1問は新規問題）
    if (reviewQuestionCount >= val) {
      setReviewQuestionCount(val - 1);
    }
  }

  const maxReview = questionCount - 1;

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

      <form action={startSessionFormAction} className="mt-6 space-y-6">
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

          <div className="mt-6 space-y-2">
            <label className="text-sm font-medium" htmlFor="questionCount">
              出題問題数
            </label>
            <input
              id="questionCount"
              name="questionCount"
              type="number"
              min={1}
              max={20}
              value={questionCount}
              onChange={handleQuestionCountChange}
              className="input w-28"
            />
            <p className="text-xs text-muted-foreground">1〜20問の範囲で設定できます</p>
          </div>

          <div className="mt-6 space-y-2">
            <label className="text-sm font-medium" htmlFor="reviewQuestionCount">
              うち復習問題数（上限）
            </label>
            <select
              id="reviewQuestionCount"
              name="reviewQuestionCount"
              value={reviewQuestionCount}
              onChange={(e) => setReviewQuestionCount(Number(e.target.value))}
              className="input w-28"
            >
              {Array.from({ length: maxReview + 1 }, (_, i) => (
                <option key={i} value={i}>
                  {i}問まで
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">過去に間違えた問題を優先的に出題します</p>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <SubmitButton />
            <p className="text-xs text-muted-foreground">{questionCount}問のクイズが始まります</p>
          </div>
        </section>
      </form>
    </main>
  );
}
