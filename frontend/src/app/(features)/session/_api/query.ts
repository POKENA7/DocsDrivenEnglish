import type { StartSessionResponse, SubmitAnswerResponse } from "@/app/api/[[...route]]/quiz";

import { honoRpcClient } from "@/lib/honoRpcClient";
import { rpcJson } from "@/lib/swr";

export type ContinueSessionInput = {
  url: string;
  mode: "word" | "reading";
};

export async function continueSessionQuery(
  input: ContinueSessionInput,
): Promise<StartSessionResponse> {
  return rpcJson<StartSessionResponse>(honoRpcClient.quiz.session.$post({ json: input }));
}

export type SubmitAnswerInput = {
  sessionId: string;
  questionId: string;
  selectedIndex: number;
};

export async function submitAnswerQuery(input: SubmitAnswerInput): Promise<SubmitAnswerResponse> {
  return rpcJson<SubmitAnswerResponse>(honoRpcClient.quiz.answer.$post({ json: input }));
}
