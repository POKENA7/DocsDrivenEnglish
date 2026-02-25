import "server-only";

import { z } from "zod";

import { createOpenAIParsedText } from "@/lib/openaiClient";

import type { MoreExplanationInput, MoreExplanationResponse } from "./types";

const MODEL = "gpt-5-mini";

const SYSTEM_PROMPT = `
あなたは英語と技術の両方に精通した学習サポーターです。
ユーザーが英語技術クイズを解いた後、さらに深く学びたいと思っています。
以下の観点で追加解説を日本語で 150〜250 字程度にまとめてください：
- 英語としての観点（語源・ニュアンス・類義語・使用シーン）
- 技術的な観点（背景知識・実際の使われ方・注意点）
箇条書きは避け、自然な文章で書いてください。
`.trim();

const MoreExplanationSchema = z.object({
  moreExplanation: z.string(),
});

export async function fetchMoreExplanation(
  input: MoreExplanationInput,
): Promise<MoreExplanationResponse> {
  const prompt = `${SYSTEM_PROMPT}

【問題】
${input.prompt}

【通常解説】
${input.explanation}

上記を踏まえて、より詳しい解説をお願いします。`;

  const parsed = await createOpenAIParsedText(
    prompt,
    MODEL,
    MoreExplanationSchema,
    "more_explanation",
    {
      maxOutputTokens: 400,
    },
  );

  return { moreExplanation: parsed.moreExplanation };
}
