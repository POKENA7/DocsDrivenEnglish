import type { HistorySummary } from "./query";
import { getHistorySummaryQuery } from "./query";

export async function getHistorySummaryAction(): Promise<HistorySummary> {
  return getHistorySummaryQuery();
}
