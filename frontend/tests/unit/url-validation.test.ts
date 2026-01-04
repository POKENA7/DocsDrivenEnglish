import { describe, expect, it } from "vitest";

import { parseHttpUrl } from "@/app/api/[[...route]]/document";

describe("parseHttpUrl", () => {
  it("rejects empty", () => {
    expect(() => parseHttpUrl(" ")).toThrow();
  });

  it("rejects non-http(s)", () => {
    expect(() => parseHttpUrl("ftp://example.com")).toThrow();
  });

  it("accepts http and https", () => {
    expect(parseHttpUrl("http://example.com").protocol).toBe("http:");
    expect(parseHttpUrl("https://example.com").protocol).toBe("https:");
  });
});
