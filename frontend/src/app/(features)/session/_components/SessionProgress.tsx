export default function SessionProgress(props: { attemptCount: number; correctCount: number }) {
  const correctRate = props.attemptCount === 0 ? 0 : props.correctCount / props.attemptCount;

  return (
    <div className="flex gap-4 text-sm text-muted-foreground">
      <span>学習した問題数: {props.attemptCount}</span>
      <span>正答率: {Math.round(correctRate * 100)}%</span>
    </div>
  );
}
