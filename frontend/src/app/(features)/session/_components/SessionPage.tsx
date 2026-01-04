"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import SourceAttribution from "./SourceAttribution";
import SessionProgress from "./SessionProgress";

type SessionSnapshot = {
  sessionId: string;
  plannedCount: number;
  actualCount: number;
  sourceUrl: string;
  sourceQuoteText: string;
  title: string | null;
  questions: Array<{
    questionId: string;
    prompt: string;
    choices: string[];
    correctIndex: number;
    explanation: string;
    sourceUrl: string;
    sourceQuoteText: string;
  }>;
};

export default function SessionPage({ session }: { session: SessionSnapshot }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [result, setResult] = useState<null | {
    isCorrect: boolean;
    explanation: string;
    sourceUrl: string;
    sourceQuoteText: string;
  }>(null);

  const current = useMemo(() => session.questions[index], [index, session.questions]);

  async function submit() {
    if (selectedIndex === null) return;

    const res = await fetch("/api/quiz/answer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        questionId: current.questionId,
        selectedIndex,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      setResult({
        isCorrect: false,
        explanation: json?.message ?? "エラーが発生しました",
        sourceUrl: session.sourceUrl,
        sourceQuoteText: session.sourceQuoteText,
      });
      return;
    }

    setResult(json);
    setAttemptCount((v) => v + 1);
    if (json.isCorrect) setCorrectCount((v) => v + 1);
  }

  function next() {
    const nextIndex = index + 1;
    if (nextIndex >= session.questions.length) {
      router.push(`/session/${session.sessionId}/complete`);
      return;
    }

    setIndex(nextIndex);
    setSelectedIndex(null);
    setResult(null);
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Quiz</h1>
        <p className="text-sm text-muted-foreground">
          {index + 1} / {session.questions.length}
        </p>
        <SessionProgress attemptCount={attemptCount} correctCount={correctCount} />
      </div>

      <section className="mt-6 space-y-4">
        <p className="text-sm font-medium">{current.prompt}</p>

        <div className="space-y-2">
          {current.choices.map((text, i) => (
            <label key={i} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="choice"
                value={i}
                checked={selectedIndex === i}
                onChange={() => setSelectedIndex(i)}
                disabled={result !== null}
              />
              {text}
            </label>
          ))}
        </div>

        {result ? (
          <div className="space-y-2 rounded-md border p-4">
            <p className="text-sm font-medium">{result.isCorrect ? "Correct" : "Incorrect"}</p>
            <p className="text-sm text-muted-foreground">{result.explanation}</p>
            <SourceAttribution
              sourceUrl={result.sourceUrl}
              sourceQuoteText={result.sourceQuoteText}
            />
          </div>
        ) : null}

        <div className="flex gap-2">
          {result ? (
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
              onClick={next}
            >
              次へ
            </button>
          ) : (
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
              onClick={submit}
              disabled={selectedIndex === null}
            >
              確定
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
