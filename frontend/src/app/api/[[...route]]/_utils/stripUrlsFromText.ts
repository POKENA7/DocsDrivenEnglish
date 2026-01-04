export function stripUrlsFromText(input: string): string {
  const s = input;

  // 1) Markdown inline link: [label](https://example.com)
  //    -> keep label, drop URL
  const withoutMarkdownLinks = s.replace(/\[([^\]]+)\]\((?:https?:\/\/|www\.)[^)]+\)/gi, "$1");

  // 1.1) Markdown in-page anchor link: [label](#ready-to-get-started)
  //      -> keep label, drop anchor
  const withoutMarkdownAnchors = withoutMarkdownLinks.replace(/\[([^\]]+)\]\(#[^)]+\)/gi, "$1");

  // 2) Autolink: <https://example.com>
  const withoutAutolinks = withoutMarkdownAnchors.replace(/<(?:https?:\/\/|www\.)[^>]+>/gi, " ");

  // 3) Bare URLs
  const withoutBareUrls = withoutAutolinks
    .replace(/\bhttps?:\/\/[^\s)\]]+/gi, " ")
    .replace(/\bwww\.[^\s)\]]+/gi, " ");

  return withoutBareUrls.replace(/\s+/g, " ").trim();
}
