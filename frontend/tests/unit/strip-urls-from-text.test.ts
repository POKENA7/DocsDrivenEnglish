import { describe, expect, test } from "vitest";

import { stripUrlsFromText } from "@/app/(features)/session/_utils/stripUrlsFromText";

describe("stripUrlsFromText", () => {
  test("removes URL from markdown inline link but keeps label", () => {
    const input = "See [MediaSource Extensions](http://w3c.github.io/media-source/) for details.";
    const out = stripUrlsFromText(input);
    expect(out).toBe("See MediaSource Extensions for details.");
  });

  test("removes bare URLs", () => {
    const input = "Open https://example.com/docs and also http://a.test/x.";
    const out = stripUrlsFromText(input);
    expect(out).toBe("Open and also");
  });

  test("removes autolinks", () => {
    const input = "Reference <https://example.com> please";
    const out = stripUrlsFromText(input);
    expect(out).toBe("Reference please");
  });

  test("removes in-page anchor markdown links but keeps label", () => {
    const input = "[ ## Ready to get started? ](#ready-to-get-started)";
    const out = stripUrlsFromText(input);
    expect(out).toBe("## Ready to get started?");
  });
});
