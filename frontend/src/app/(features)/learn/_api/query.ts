import type { StartSessionResponse } from "@/app/api/[[...route]]/quiz";

import { honoRpcClient } from "@/lib/honoRpcClient";
import { rpcJson } from "@/lib/swr";

export type StartSessionInput = {
  url: string;
  mode: "word" | "reading";
};

export async function startSessionQuery(input: StartSessionInput): Promise<StartSessionResponse> {
  return rpcJson<StartSessionResponse>(honoRpcClient.quiz.session.$post({ json: input }));
}
