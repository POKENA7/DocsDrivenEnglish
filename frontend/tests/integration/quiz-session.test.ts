import { describe, expect, it, vi } from "vitest";

import { apiApp } from "@/app/api/[[...route]]/app";

vi.mock("@/lib/openaiClient", () => {
  return {
    OPENAI_MAX_OUTPUT_TOKENS: 10,
    OPENAI_TIMEOUT_MS: 1000,
    createOpenAIParsedText: vi.fn(
      async (_input: string, _model: string, _schema: unknown, schemaName: string) => {
        if (schemaName === "quiz_items_ja") {
          return {
            items: [
              {
                prompt:
                  "次の英文の意味として最も適切なものを選んでください。\n英文: Some content for quiz.",
                choices: ["ダミー1", "ダミー2", "ダミー3", "ダミー4"],
                correctIndex: 0,
                explanation: "ダミー解説",
              },
            ],
          };
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

describe("POST /api/quiz/session", () => {
  it("returns 400 for empty topic", async () => {
    const res = await apiApp.request("http://localhost/api/quiz/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topic: "", mode: "word" }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 200 for valid input", async () => {
    const res = await apiApp.request("http://localhost/api/quiz/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topic: "React Hooks", mode: "word" }),
    });

    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.sessionId).toBeTruthy();
    expect(json.plannedCount).toBe(5);
    expect(json.topic).toBe("React Hooks");
    expect(Array.isArray(json.questions)).toBe(true);
  });
});
