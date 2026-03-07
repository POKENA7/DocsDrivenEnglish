import { useState } from "react";
import { useRouter } from "next/navigation";

import { useQuizAnswer } from "./useQuizAnswer";

export type SessionSnapshot = {
  sessionId: string;
  topic: string;
  questions: Array<{
    questionId: string;
    prompt: string;
    choices: string[];
    correctIndex: number;
    explanation: string;
  }>;
};

export function useQuizSession(session: SessionSnapshot) {
  const router = useRouter();
  const { submit: submitAnswer, isSubmitting } = useQuizAnswer();

  const [index, setIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [result, setResult] = useState<null | {
    isCorrect: boolean;
    explanation: string;
    isReviewRegistered?: boolean;
    reviewNextAt?: number;
  }>(null);

  const current = session.questions[index];

  async function submit() {
    if (selectedIndex === null) return;
    if (result !== null) return;

    try {
      const out = await submitAnswer({
        sessionId: session.sessionId,
        questionId: current.questionId,
        selectedIndex,
      });

      setResult(out);
      setAttemptCount((v) => v + 1);
      if (out.isCorrect) setCorrectCount((v) => v + 1);
    } catch (e) {
      const message = e instanceof Error ? e.message : "エラーが発生しました";
      setResult({
        isCorrect: false,
        explanation: message,
      });
    }
  }

  function next() {
    const nextIndex = index + 1;
    if (nextIndex >= session.questions.length) {
      router.push(`/learn/${session.sessionId}/complete`);
      return;
    }

    setIndex(nextIndex);
    setSelectedIndex(null);
    setResult(null);
  }

  return {
    index,
    current,
    selectedIndex,
    setSelectedIndex,
    attemptCount,
    correctCount,
    result,
    isSubmitting,
    submit,
    next,
  };
}
