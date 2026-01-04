import SessionCompletePage from "../../_components/SessionCompletePage";

import { getSessionSnapshot } from "@/app/api/[[...route]]/quiz";

type Params = {
  sessionId: string;
};

type PageProps = {
  params: Promise<Params>;
};

export default async function SessionComplete({ params }: PageProps) {
  const { sessionId } = await params;
  const session = getSessionSnapshot(sessionId);

  return (
    <SessionCompletePage
      sessionId={sessionId}
      inputUrl={session?.inputUrl ?? null}
      mode={session?.mode ?? null}
    />
  );
}
