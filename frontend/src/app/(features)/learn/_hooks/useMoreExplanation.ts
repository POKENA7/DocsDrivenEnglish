import { useState } from "react";

import { fetchMoreExplanationAction } from "../_api/actions";
import type { MoreExplanationInput } from "@/server/quiz/types";

export function useMoreExplanation(questionId: string) {
  const [fetched, setFetched] = useState<{ questionId: string; text: string } | null>(null);
  const [fetchError, setFetchError] = useState<{ questionId: string; message: string } | null>(
    null,
  );
  const [isFetching, setIsFetching] = useState(false);

  const moreExplanation = fetched?.questionId === questionId ? fetched.text : null;
  const error = fetchError?.questionId === questionId ? fetchError.message : null;

  async function fetch(input: MoreExplanationInput) {
    if (moreExplanation !== null) return;
    setIsFetching(true);
    setFetchError(null);
    try {
      const res = await fetchMoreExplanationAction(input);
      setFetched({ questionId, text: res.moreExplanation });
    } catch (e) {
      setFetchError({
        questionId,
        message: e instanceof Error ? e.message : "エラーが発生しました",
      });
    } finally {
      setIsFetching(false);
    }
  }

  return { moreExplanation, isFetching, error, fetch };
}
