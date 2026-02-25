import { useCallback, useState } from "react";

import { fetchMoreExplanationAction } from "../_api/actions";
import type { MoreExplanationInput } from "@/server/quiz/types";

export function useMoreExplanation() {
  const [moreExplanation, setMoreExplanation] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setMoreExplanation(null);
    setError(null);
  }, []);

  async function fetch(input: MoreExplanationInput) {
    if (moreExplanation !== null) return;
    setIsFetching(true);
    setError(null);
    try {
      const res = await fetchMoreExplanationAction(input);
      setMoreExplanation(res.moreExplanation);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setIsFetching(false);
    }
  }

  return { moreExplanation, isFetching, error, fetch, reset };
}
