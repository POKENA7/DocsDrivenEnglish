import SessionCompletePage from "../../_components/SessionCompletePage";

import { getSessionSnapshot } from "@/server/quiz/query";

type Params = {
  sessionId: string;
};

type PageProps = {
  params: Promise<Params>;
};

export default async function LearnSessionComplete({ params }: PageProps) {
  const { sessionId } = await params;
  const session = await getSessionSnapshot(sessionId);

  return <SessionCompletePage sessionId={sessionId} topic={session.topic} mode={session.mode} />;
}
