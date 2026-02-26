import "server-only";

import { z } from "zod";

import { createOpenAIParsedText } from "@/lib/openaiClient";

import type { Mode } from "./types";

const STRUCTURED_OUTPUTS_MODEL = "gpt-5-mini";

const quizItemSchema = z.object({
  prompt: z.string(),
  // NOTE: OpenAI Structured Outputs は JSON Schema の tuple 表現（items が配列）を受け付けないため、
  // 「配列 + min/max=4」で表現する。
  choices: z.array(z.string()).min(4).max(4),
  correctIndex: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  explanation: z.string(),
});

type GeneratedQuizItem = z.infer<typeof quizItemSchema>;

export async function generateQuizItemsFromTopic(
  topic: string,
  mode: Mode,
  questionCount: number,
): Promise<GeneratedQuizItem[]> {
  const trimmedTopic = topic.trim();
  if (!trimmedTopic) return [];

  console.log("[quiz] generating quiz items, topic = ", { topic: trimmedTopic, questionCount });

  const QuizItemsSchema = z.object({
    items: z.array(quizItemSchema).min(1).max(questionCount),
  });

  const base =
    "あなたは『英語と技術の両方を学べるプログラマー向け英語学習サイト』のクイズ作成者です。\n" +
    "英語学習サイトであるため、出題内容は技術知識を前提とせず、英文を読むことで解ける内容にしてください。\n" +
    "扱う文章は技術ドキュメント（APIドキュメント/仕様/README/設計書など）に出てくる表現を想定しています。\n" +
    `技術トピック: ${trimmedTopic}\n` +
    "共通要件（厳守）:\n" +
    `- 必ず${questionCount}問作ること。\n` +
    "- prompt(問題文), choices(選択肢), explanation(解説)はすべて日本語。\n" +
    "- promptは以下のセクションとし、セクション間は改行すること。\n" +
    "  1) 問題文（日本語）\n" +
    "  2) 『原文:』で始まるセクションに、問題の根拠となる英文の想定例文を書く。\n" +
    "- choices は必ず4つ。正解は correctIndex(0-3) で示す。\n" +
    "- correctIndex は問題ごとに 0, 1, 2, 3 をまんべんなく使い、特定の位置に偏らないようにすること。\n" +
    "- 選択肢は『よくある誤読/別の語義/似た概念』など、学習価値がある紛らわしさにする（ただし重複や同義反復は避ける）。\n" +
    "- 4つの選択肢の文章量（文字数）はできるだけ揃えること。正解だけ長い・短いなど、文章量の偏りで正解が推測できてはいけない。\n" +
    "- 難易度は中〜上級を目指す。表面的な意味ではなく、文脈依存の意味・ニュアンス・論理関係を問うこと。\n" +
    "- 誤りの選択肢は『一見もっともらしいが原文を正確に読むと違う』ものにする。明らかに間違いとわかる選択肢は避ける。\n" +
    "- 解説は1文で簡潔に。\n" +
    "- 実在する技術ドキュメントの記述を想定した問題にし、造語・架空の用語は使わないこと。\n" +
    "- 同一セッション内で同じ単語・フレーズを重複して出題しないこと。\n";

  const modeSpecific =
    mode === "word"
      ? "word モード要件（厳守）:\n" +
        `- 『${trimmedTopic}』に深く関連した英単語/英語フレーズを1つ選び、『日本語の意味』を4択で問う。\n` +
        "- 基本的な意味ではなく、文脈上の意味やニュアンスを問う。多義語や文脈依存の語義を優先的に出題する。\n"
      : "reading モード要件（厳守）:\n" +
        `- 『${trimmedTopic}』の公式ドキュメント・仕様書に出てきそうな英文（3〜5文）を自ら構成し、その読解を問う。\n` +
        "- choices は本文の内容理解を問う日本語の選択肢にする（単なる逐語訳の4択にはしない）。\n" +
        "- 【重要】4つの選択肢はすべて同程度の長さ・詳しさで書くこと。正解の選択肢だけ具体的で長く、不正解が短く曖昧になるパターンは厳禁。不正解の選択肢も正解と同じレベルの具体性・もっともらしさで書く。\n" +
        "- 原文の論理構造（因果関係・条件・対比・限定）を正確に読み取らないと解けない問題を出す。表面的なキーワード一致では正解できないようにする。\n";

  const prompt = base + modeSpecific;

  const parsed = await createOpenAIParsedText(
    prompt,
    STRUCTURED_OUTPUTS_MODEL,
    QuizItemsSchema,
    "quiz_items_ja",
    { maxOutputTokens: 8000 },
  );

  return parsed.items.map((item) => ({
    ...item,
    prompt: item.prompt.trim(),
    explanation: item.explanation.trim(),
    choices: item.choices.map((c) => c.trim()),
  }));
}
