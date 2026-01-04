import type { StartSessionResponse } from "@/app/api/[[...route]]/quiz";

import type { StartSessionInput } from "./query";
import { startSessionQuery } from "./query";

export async function startSessionAction(input: StartSessionInput): Promise<StartSessionResponse> {
  return startSessionQuery(input);
}
