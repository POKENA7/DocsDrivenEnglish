import useSWR from "swr";

import { ApiClientError } from "@/lib/swr";

import { getHistorySummaryAction } from "../_api/actions";

export function useHistorySummary() {
  const swr = useSWR("history/summary", () => getHistorySummaryAction());

  if (swr.isLoading) {
    return { status: "loading" as const, summary: null, error: null };
  }

  if (swr.error) {
    if (swr.error instanceof ApiClientError && swr.error.status === 401) {
      return { status: "unauthed" as const, summary: null, error: null };
    }

    return {
      status: "error" as const,
      summary: null,
      error: swr.error instanceof Error ? swr.error.message : "取得に失敗しました。",
    };
  }

  return { status: "authed" as const, summary: swr.data ?? null, error: null };
}
