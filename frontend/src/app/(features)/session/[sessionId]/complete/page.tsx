import SessionCompletePage from "../../_components/SessionCompletePage";

import { getSessionSnapshot } from "@/app/api/[[...route]]/quiz";

type Params = {
  sessionId: string;
};

export default function SessionComplete({ params }: { params: Params }) {
  const session = getSessionSnapshot(params.sessionId);

  return (
    <SessionCompletePage
      sessionId={params.sessionId}
      inputUrl={session?.inputUrl ?? null}
      mode={session?.mode ?? null}
    />
  );
}
