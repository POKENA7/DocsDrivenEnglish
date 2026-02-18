"use client";

import { useQuizSession, type SessionSnapshot } from "../_hooks/useQuizSession";

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
    <main className="container-page page">
      <div className="reveal">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="heading-1">Quiz</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {index + 1} / {session.questions.length}
            </p>
          </div>

          <p className="text-xs text-muted-foreground">{session.topic}</p>
        </div>

        <SessionProgress attemptCount={attemptCount} correctCount={correctCount} />
      </div>

      <section className="mt-6 space-y-4">
        <div className="card reveal" style={{ animationDelay: "80ms" }}>
          <p className="text-xs font-semibold tracking-tight text-muted-foreground">問題</p>
          <p className="mt-3 whitespace-pre-line text-sm font-medium leading-relaxed">
            {current.prompt}
          </p>

          <div className="mt-5 grid gap-2">
            {current.choices.map((text, i) => {
              const disabled = result !== null || isSubmitting;
              const selected = selectedIndex === i;

              const showCorrect = result !== null && i === current.correctIndex;
              const showIncorrect =
                result !== null && selectedIndex === i && i !== current.correctIndex;

              const extra = showCorrect
                ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                : showIncorrect
                  ? "border-destructive bg-destructive/10 ring-2 ring-destructive/15"
                  : "";

              return (
                <label
                  key={i}
                  className={`choice ${extra}`}
                  data-disabled={disabled ? "true" : "false"}
                >
                  <input
                    type="radio"
                    name="choice"
                    value={i}
                    checked={selected}
                    onChange={() => setSelectedIndex(i)}
                    disabled={disabled}
                    className="mt-0.5"
                  />
                  <span className="leading-relaxed">{text}</span>
                </label>
              );
            })}
          </div>

          <div className="mt-6 flex items-center gap-2">
            {result ? (
              <button type="button" className="btn btn-primary" onClick={next}>
                次へ
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={submit}
                disabled={selectedIndex === null || isSubmitting}
              >
                {isSubmitting ? "送信中..." : "確定"}
              </button>
            )}

            {result ? (
              <p
                role="status"
                aria-live="polite"
                className={`result-badge ${
                  result.isCorrect ? "result-badge--correct" : "result-badge--incorrect"
                }`}
              >
                {result.isCorrect ? "Correct!" : "Incorrect"}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">選択してから確定してください</p>
            )}
          </div>
        </div>

        {result ? (
          <div className="card reveal" style={{ animationDelay: "140ms" }}>
            <p className="text-xs font-semibold tracking-tight text-muted-foreground">解説</p>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {result.explanation}
            </p>
          </div>
        ) : null}
      </section>
    </main>
  );
}
