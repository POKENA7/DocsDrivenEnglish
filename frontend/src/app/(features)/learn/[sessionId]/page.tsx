import SessionPage from "../_components/SessionPage";

import { getSessionSnapshot } from "@/server/quiz/query";

type Params = {
  sessionId: string;
};

type PageProps = {
  params: Promise<Params>;
};

export default async function LearnSessionPage({ params }: PageProps) {
  const { sessionId } = await params;
  const session = await getSessionSnapshot(sessionId);

  return <SessionPage session={session} />;
}
