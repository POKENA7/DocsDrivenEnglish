import SessionCompletePage from "../../_components/SessionCompletePage";

import { getSessionSnapshot } from "@/app/(features)/learn/_api/mutations";

type Params = {
  sessionId: string;
};

type PageProps = {
  params: Promise<Params>;
};

export default async function LearnSessionComplete({ params }: PageProps) {
  const { sessionId } = await params;
  const session = await getSessionSnapshot(sessionId);

  return (
    <SessionCompletePage
      sessionId={sessionId}
      topic={session?.topic ?? null}
      mode={session?.mode ?? null}
    />
  );
}
