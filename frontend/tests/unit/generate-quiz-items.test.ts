import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("@/lib/openaiClient", () => ({
  OPENAI_MAX_OUTPUT_TOKENS: 2048,
  OPENAI_TIMEOUT_MS: 90_000,
  createOpenAIParsedText: vi.fn(),
}));

const { createOpenAIParsedText } = await import("@/lib/openaiClient");
const { generateQuizItemsFromTopic } = await import("@/server/quiz/generate");

const generatedItem = {
  prompt: "  問題文  ",
  choices: ["  選択肢1  ", " 選択肢2", "選択肢3 ", "  選択肢4"],
  correctIndex: 1 as const,
  explanation: "  解説  ",
};

describe("generateQuizItemsFromTopic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("topic が空白のみのときは OpenAI を呼ばず空配列を返す", async () => {
    const result = await generateQuizItemsFromTopic("   ", "word", 3);

    expect(result).toEqual([]);
    expect(createOpenAIParsedText).not.toHaveBeenCalled();
  });

  it("word モードでは prompt と schema を正しく組み立て、返却値を trim する", async () => {
    vi.mocked(createOpenAIParsedText).mockResolvedValue({
      items: [generatedItem],
    } as never);

    const result = await generateQuizItemsFromTopic("  React Hooks  ", "word", 3);

    expect(result).toEqual([
      {
        prompt: "問題文",
        choices: ["選択肢1", "選択肢2", "選択肢3", "選択肢4"],
        correctIndex: 1,
        explanation: "解説",
      },
    ]);

    const [prompt, model, schema, schemaName, options] =
      vi.mocked(createOpenAIParsedText).mock.calls[0]!;

    expect(model).toBe("gpt-5-mini");
    expect(schemaName).toBe("quiz_items_ja");
    expect(options).toEqual({ maxOutputTokens: 8000 });
    expect(prompt).toContain("技術トピック: React Hooks");
    expect(prompt).toContain("word モード要件（厳守）");
    expect(prompt).toContain("必ず3問作ること。");

    const quizItemsSchema = schema as z.ZodTypeAny;
    const validItem = {
      prompt: "問題",
      choices: ["A", "B", "C", "D"],
      correctIndex: 0,
      explanation: "解説",
    };
    expect(
      quizItemsSchema.safeParse({
        items: [validItem, validItem, validItem],
      }).success,
    ).toBe(true);
    expect(
      quizItemsSchema.safeParse({
        items: [validItem, validItem, validItem, validItem],
      }).success,
    ).toBe(false);
  });

  it("reading モードでは reading 向け prompt を使う", async () => {
    vi.mocked(createOpenAIParsedText).mockResolvedValue({
      items: [generatedItem],
    } as never);

    await generateQuizItemsFromTopic("Kubernetes Pod", "reading", 2);

    const [prompt] = vi.mocked(createOpenAIParsedText).mock.calls[0]!;
    expect(prompt).toContain("reading モード要件（厳守）");
    expect(prompt).toContain("公式ドキュメント・仕様書に出てきそうな英文（3〜5文）");
    expect(prompt).not.toContain("word モード要件（厳守）");
  });
});
