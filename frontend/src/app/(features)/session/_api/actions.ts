import type { StartSessionResponse, SubmitAnswerResponse } from "@/app/api/[[...route]]/quiz";

import type { ContinueSessionInput, SubmitAnswerInput } from "./query";
import { continueSessionQuery, submitAnswerQuery } from "./query";

export async function continueSessionAction(
  input: ContinueSessionInput,
): Promise<StartSessionResponse> {
  return continueSessionQuery(input);
}

export async function submitQuizAnswerAction(
  input: SubmitAnswerInput,
): Promise<SubmitAnswerResponse> {
  return submitAnswerQuery(input);
}
