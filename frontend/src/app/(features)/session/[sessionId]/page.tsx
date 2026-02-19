import { notFound } from "next/navigation";

import SessionPage from "../_components/SessionPage";

import { getSessionSnapshot } from "@/app/api/[[...route]]/quiz";

export const dynamic = "force-dynamic";

type Params = {
  sessionId: string;
};

type PageProps = {
  params: Promise<Params>;
};

export default async function SessionIdPage({ params }: PageProps) {
  const { sessionId } = await params;
  const session = await getSessionSnapshot(sessionId);

  if (!session) {
    notFound();
  }

  return <SessionPage session={session} />;
}
