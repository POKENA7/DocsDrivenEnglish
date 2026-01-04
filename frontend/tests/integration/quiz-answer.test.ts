import { describe, expect, it, vi } from "vitest";

import { apiApp } from "@/app/api/[[...route]]/route";

vi.mock("@clerk/nextjs/server", () => {
  return {
    auth: () => ({ userId: null }),
  };
});

vi.mock("@/lib/openaiClient", () => {
  return {
    OPENAI_MAX_OUTPUT_TOKENS: 10,
    OPENAI_TIMEOUT_MS: 1000,
    createOpenAIResponse: vi.fn(async () => {
      return {
        output_text: "dummy",
      };
    }),
  };
});

describe("POST /api/quiz/answer", () => {
  it("scores answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          "<!doctype html><html><body><article><p>Some content for quiz.</p></article></body></html>",
          { headers: { "content-type": "text/html" } },
        );
      }),
    );

    const start = await apiApp.request("http://localhost/api/quiz/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.com", mode: "word" }),
    });
    expect(start.status).toBe(200);

    const started = await start.json();
    const first = started.questions[0];

    const res = await apiApp.request("http://localhost/api/quiz/answer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: started.sessionId,
        questionId: first.questionId,
        selectedIndex: 0,
      }),
    });

    expect(res.status).toBe(200);

    const json = await res.json();
    expect(typeof json.isCorrect).toBe("boolean");
    expect(typeof json.explanation).toBe("string");
    expect(json.sourceUrl).toBeTruthy();
    expect(json.sourceQuoteText).toBeTruthy();
  });
});
