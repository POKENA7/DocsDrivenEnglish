import { describe, expect, it, vi } from "vitest";

import { apiApp } from "@/app/api/[[...route]]/app";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => ({ userId: "test-user" })),
}));

vi.mock("@/lib/openaiClient", () => {
  return {
    OPENAI_MAX_OUTPUT_TOKENS: 10,
    OPENAI_TIMEOUT_MS: 1000,
    createOpenAIParsedText: vi.fn(
      async (_input: string, _model: string, _schema: unknown, schemaName: string) => {
        if (schemaName === "quiz_items_ja") {
          return { items: [] };
        }
        return {
          term: "term",
          prompt: "ダミー",
          choices: ["ダミー1", "ダミー2", "ダミー3", "ダミー4"],
          correctIndex: 0,
          explanation: "ダミー解説",
        };
      },
    ),
    createOpenAIResponse: vi.fn(async () => {
      return {
        output_text: "dummy",
      };
    }),
  };
});

describe("POST /api/quiz/session errors", () => {
  it("returns 400 when topic is empty", async () => {
    const res = await apiApp.request("http://localhost/api/quiz/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topic: "", mode: "word" }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 when topic is whitespace only", async () => {
    const res = await apiApp.request("http://localhost/api/quiz/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topic: "   ", mode: "word" }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 500 when LLM returns no items", async () => {
    const res = await apiApp.request("http://localhost/api/quiz/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topic: "React Hooks", mode: "word" }),
    });

    // items: [] のモックなので 500
    expect(res.status).toBe(500);
  });
});
