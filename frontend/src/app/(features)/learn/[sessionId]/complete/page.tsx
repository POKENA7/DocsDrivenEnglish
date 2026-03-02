import SessionCompletePage from "../../_components/SessionCompletePage";

import { getSessionResult } from "@/server/quiz/query";

type Params = {
  sessionId: string;
};

type PageProps = {
  params: Promise<Params>;
};

export default async function LearnSessionComplete({ params }: PageProps) {
  const { sessionId } = await params;
  const result = await getSessionResult(sessionId);

  return <SessionCompletePage result={result} sessionId={sessionId} />;
}
