import SessionPage from "../_components/SessionPage";

import { getSessionSnapshot } from "@/app/(features)/learn/_api/mutations";

type Params = {
  sessionId: string;
};

type PageProps = {
  params: Promise<Params>;
};

export default async function LearnSessionPage({ params }: PageProps) {
  const { sessionId } = await params;
  const session = await getSessionSnapshot(sessionId);

  if (!session) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <p className="text-sm text-muted-foreground">セッションが見つかりませんでした。</p>
      </main>
    );
  }

  return <SessionPage session={session} />;
}
