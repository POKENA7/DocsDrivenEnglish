import { describe, expect, it } from "vitest";

import { extractDocument } from "@/app/api/[[...route]]/document";

describe("extractDocument", () => {
  it("extracts markdown/title/quote", () => {
    const html = `<!doctype html>
<html>
  <head><title>Example Title</title></head>
  <body>
    <article>
      <h1>Example Title</h1>
      <p>This is a sample paragraph that should be extracted.</p>
      <pre><code>const x = 1;</code></pre>
    </article>
  </body>
</html>`;

    const out = extractDocument(html, new URL("https://example.com"));

    expect(out.title).toBeTruthy();
    expect(out.markdown).toContain("sample paragraph");
    expect(out.sourceUrl).toBe("https://example.com/");
    expect(out.sourceQuoteText.length).toBeGreaterThan(0);
  });
});
