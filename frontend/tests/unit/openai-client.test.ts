import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mockParse = vi.fn();
const mockOpenAI = vi.fn(function MockOpenAI() {
  return {
    responses: {
      parse: mockParse,
    },
  };
});
const mockZodTextFormat = vi.fn(() => ({ type: "json_schema" }));
const mockGetEnv = vi.fn(() => ({
  OPENAI_API_KEY: "test-openai-key",
}));

vi.mock("openai", () => ({
  default: mockOpenAI,
}));

vi.mock("openai/helpers/zod", () => ({
  zodTextFormat: mockZodTextFormat,
}));

vi.mock("@/app/env/env", () => ({
  getEnv: mockGetEnv,
}));

const resultSchema = z.object({
  message: z.string(),
});

describe("createOpenAIParsedText", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  it("output_parsed があればそのまま返す", async () => {
    mockParse.mockResolvedValue({
      id: "resp_parsed",
      model: "gpt-5-mini",
      output_parsed: { message: "parsed" },
      output_text: "",
      incomplete_details: null,
      status: "completed",
    });

    const { createOpenAIParsedText } = await import("@/lib/openaiClient");

    const result = await createOpenAIParsedText("prompt", "gpt-5-mini", resultSchema, "result");

    expect(result).toEqual({ message: "parsed" });
    expect(mockOpenAI).toHaveBeenCalledTimes(1);
    expect(mockZodTextFormat).toHaveBeenCalledWith(resultSchema, "result");
  });

  it("status が incomplete なら専用エラーを投げる", async () => {
    mockParse.mockResolvedValue({
      id: "resp_incomplete",
      model: "gpt-5-mini",
      output_parsed: null,
      output_text: "",
      incomplete_details: null,
      status: "incomplete",
    });

    const { createOpenAIParsedText } = await import("@/lib/openaiClient");

    await expect(
      createOpenAIParsedText("prompt", "gpt-5-mini", resultSchema, "result"),
    ).rejects.toThrow("OpenAI response was incomplete");
  });

  it("incomplete_details があれば incomplete として扱う", async () => {
    mockParse.mockResolvedValue({
      id: "resp_incomplete_details",
      model: "gpt-5-mini",
      output_parsed: null,
      output_text: '{"message":"ignored"}',
      incomplete_details: { reason: "max_output_tokens" },
      status: "completed",
    });

    const { createOpenAIParsedText } = await import("@/lib/openaiClient");

    await expect(
      createOpenAIParsedText("prompt", "gpt-5-mini", resultSchema, "result"),
    ).rejects.toThrow("OpenAI response was incomplete");
  });

  it("output_text が空なら明示的なエラーを投げる", async () => {
    mockParse.mockResolvedValue({
      id: "resp_empty_text",
      model: "gpt-5-mini",
      output_parsed: null,
      output_text: "",
      incomplete_details: null,
      status: "completed",
    });

    const { createOpenAIParsedText } = await import("@/lib/openaiClient");

    await expect(
      createOpenAIParsedText("prompt", "gpt-5-mini", resultSchema, "result"),
    ).rejects.toThrow("OpenAI response.output_text is empty");
  });

  it("output_text から fallback で JSON を復元できる", async () => {
    mockParse.mockResolvedValue({
      id: "resp_fallback",
      model: "gpt-5-mini",
      output_parsed: null,
      output_text: '{"message":"fallback"}',
      incomplete_details: null,
      status: "completed",
    });

    const { createOpenAIParsedText } = await import("@/lib/openaiClient");

    const result = await createOpenAIParsedText("prompt", "gpt-5-mini", resultSchema, "result");

    expect(result).toEqual({ message: "fallback" });
  });

  it("fallback JSON が壊れていれば parse エラーを伝播する", async () => {
    mockParse.mockResolvedValue({
      id: "resp_invalid_json",
      model: "gpt-5-mini",
      output_parsed: null,
      output_text: '{"message":"broken"',
      incomplete_details: null,
      status: "completed",
    });

    const { createOpenAIParsedText } = await import("@/lib/openaiClient");

    await expect(
      createOpenAIParsedText("prompt", "gpt-5-mini", resultSchema, "result"),
    ).rejects.toThrow(SyntaxError);
  });
});
