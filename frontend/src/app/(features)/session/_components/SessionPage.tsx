"use client";

import { useQuizSession, type SessionSnapshot } from "../_hooks/useQuizSession";

import SourceAttribution from "./SourceAttribution";
import SessionProgress from "./SessionProgress";

export default function SessionPage({ session }: { session: SessionSnapshot }) {
  const {
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
  } = useQuizSession(session);

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
                disabled={result !== null || isSubmitting}
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
              disabled={selectedIndex === null || isSubmitting}
            >
              確定
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
