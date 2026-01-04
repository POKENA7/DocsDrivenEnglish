import { honoRpcClient } from "@/lib/honoRpcClient";
import { rpcJson } from "@/lib/swr";

export type HistorySummary = {
  attemptCount: number;
  correctRate: number;
  studyDays: number;
};

export async function getHistorySummaryQuery(): Promise<HistorySummary> {
  return rpcJson<HistorySummary>(honoRpcClient.history.summary.$get());
}
