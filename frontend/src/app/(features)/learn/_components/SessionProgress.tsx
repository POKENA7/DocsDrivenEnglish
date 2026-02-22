export default function SessionProgress(props: { attemptCount: number; correctCount: number }) {
  const correctRate = props.attemptCount === 0 ? 0 : props.correctCount / props.attemptCount;

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      <div className="card-compact">
        <p className="text-xs text-muted-foreground">学習した問題数</p>
        <p className="mt-1 text-lg font-semibold tracking-tight">{props.attemptCount}</p>
      </div>
      <div className="card-compact">
        <p className="text-xs text-muted-foreground">正答率</p>
        <p className="mt-1 text-lg font-semibold tracking-tight">
          {Math.round(correctRate * 100)}%
        </p>
      </div>
    </div>
  );
}
