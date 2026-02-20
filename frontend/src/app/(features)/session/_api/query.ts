import type { StartSessionResponse } from "@/app/api/[[...route]]/quiz";

import { honoRpcClient } from "@/lib/honoRpcClient";
import { rpcJson } from "@/lib/swr";

export type ContinueSessionInput = {
  topic: string;
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
