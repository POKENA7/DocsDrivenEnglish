export default function SourceAttribution(props: { sourceUrl: string; sourceQuoteText: string }) {
  return (
    <section className="mt-5 rounded-2xl border bg-muted/25 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold tracking-tight text-muted-foreground">Source</h2>
        <a
          className="text-xs underline underline-offset-4"
          href={props.sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          開く
        </a>
      </div>

      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
        {props.sourceQuoteText}
      </p>
      <p className="mt-3 break-all text-xs text-muted-foreground">{props.sourceUrl}</p>
    </section>
  );
}
