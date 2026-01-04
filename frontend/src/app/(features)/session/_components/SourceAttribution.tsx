export default function SourceAttribution(props: { sourceUrl: string; sourceQuoteText: string }) {
  return (
    <section className="mt-6 space-y-2 rounded-md border bg-muted/30 p-4">
      <h2 className="text-sm font-medium">Source</h2>
      <p className="text-sm text-muted-foreground">{props.sourceQuoteText}</p>
      <a className="text-sm underline" href={props.sourceUrl} target="_blank" rel="noreferrer">
        {props.sourceUrl}
      </a>
    </section>
  );
}
