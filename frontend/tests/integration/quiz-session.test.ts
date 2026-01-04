import { describe, expect, it, vi } from "vitest";

import { apiApp } from "@/app/api/[[...route]]/app";

vi.mock("@/lib/openaiClient", () => {
  return {
    OPENAI_MAX_OUTPUT_TOKENS: 10,
    OPENAI_TIMEOUT_MS: 1000,
    createOpenAIParsedText: vi.fn(
      async (_input: string, _model: string, _schema: unknown, schemaName: string) => {
        if (schemaName === "term_explanations") {
          const terms = Array.from(_input.matchAll(/^-\s+([a-z0-9-]+)\s*$/gim)).map((m) => m[1]);
          return {
            items: terms.map((term) => ({ term, explanation: "dummy" })),
          };
        }

        return { explanation: "dummy" };
      },
    ),
    createOpenAIResponse: vi.fn(async () => {
      return {
        output_text: "dummy",
      };
    }),
  };
});

describe("POST /api/quiz/session", () => {
  it("returns 400 for invalid url", async () => {
    const res = await apiApp.request("http://localhost/api/quiz/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "", mode: "word" }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 200 for valid input", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          "<!doctype html><html><body><article><p>Some content for quiz.</p></article></body></html>",
          { headers: { "content-type": "text/html" } },
        );
      }),
    );

    const res = await apiApp.request("http://localhost/api/quiz/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.com", mode: "word" }),
    });

    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.sessionId).toBeTruthy();
    expect(json.plannedCount).toBe(10);
    expect(Array.isArray(json.questions)).toBe(true);
  });
});
