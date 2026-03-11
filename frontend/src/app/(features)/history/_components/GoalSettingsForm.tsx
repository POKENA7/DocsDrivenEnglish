"use client";

import { useActionState } from "react";
import { updateUserSettingsAction } from "../_api/actions";

type Props = {
  dailyGoalCount: number;
  dailyReviewCount: number;
};

export default function GoalSettingsForm({ dailyGoalCount, dailyReviewCount }: Props) {
  const [state, action, isPending] = useActionState(updateUserSettingsAction, { error: null });

  return (
    <form action={action} className="mt-4 space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="dailyGoalCount">
          1日の目標問題数
        </label>
        <input
          id="dailyGoalCount"
          name="dailyGoalCount"
          type="number"
          min={1}
          max={20}
          defaultValue={dailyGoalCount}
          className="input w-28"
        />
        <p className="text-xs text-muted-foreground">1〜20問の範囲で設定できます</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="dailyReviewCount">
          復習問題数（上限）
        </label>
        <input
          id="dailyReviewCount"
          name="dailyReviewCount"
          type="number"
          min={0}
          max={19}
          defaultValue={dailyReviewCount}
          className="input w-28"
        />
        <p className="text-xs text-muted-foreground">セッションに含める復習問題の上限数</p>
      </div>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={isPending} className="btn btn-primary">
        {isPending ? "保存中..." : "保存"}
      </button>
    </form>
  );
}
