import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWRMutation from "swr/mutation";

import { startSessionAction } from "../_api/actions";

export function useLearnStart() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const mutation = useSWRMutation(
    "quiz/session",
    async (_key, { arg }: { arg: { topic: string; mode: "word" | "reading" } }) => {
      return startSessionAction(arg);
    },
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const topic = String(formData.get("topic") ?? "");
    const mode = String(formData.get("mode") ?? "word");

    if (mode !== "word" && mode !== "reading") {
      setError("mode が不正です");
      return;
    }

    setError(null);

    try {
      const session = await mutation.trigger({ topic, mode });
      router.push(`/session/${session.sessionId}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "エラーが発生しました";
      setError(message);
    }
  }

  return {
    onSubmit,
    pending: mutation.isMutating,
    error,
  };
}
