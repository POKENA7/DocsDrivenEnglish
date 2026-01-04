import SessionPage from "../_components/SessionPage";

import { getSessionSnapshot } from "@/app/api/[[...route]]/quiz";

type Params = {
  sessionId: string;
};

export default function SessionIdPage({ params }: { params: Params }) {
  const session = getSessionSnapshot(params.sessionId);

  if (!session) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <p className="text-sm text-muted-foreground">セッションが見つかりませんでした。</p>
      </main>
    );
  }

  return <SessionPage session={session} />;
}
