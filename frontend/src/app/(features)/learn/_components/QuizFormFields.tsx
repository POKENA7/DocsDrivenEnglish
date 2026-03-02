"use client";

import type React from "react";

type Props = {
  questionCount: number;
  reviewQuestionCount: number;
  onQuestionCountChange: (val: number) => void;
  onReviewQuestionCountChange: (val: number) => void;
};

export default function QuizFormFields({
  questionCount,
  reviewQuestionCount,
  onQuestionCountChange,
  onReviewQuestionCountChange,
}: Props) {
  function handleQuestionCountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = Math.max(1, Math.min(20, Number(e.target.value) || 1));
    onQuestionCountChange(val);
    if (reviewQuestionCount >= val) {
      onReviewQuestionCountChange(val - 1);
    }
  }

  const maxReview = questionCount - 1;

  return (
    <>
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
          onChange={(e) => onReviewQuestionCountChange(Number(e.target.value))}
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
    </>
  );
}
