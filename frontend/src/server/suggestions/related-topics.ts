import "server-only";

import { and, desc, eq, isNull, ne, or } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db/client";
import { sessions, topicSuggestionsCache } from "@/db/schema";
import { createOpenAIParsedText } from "@/lib/openaiClient";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SHARED_TOPIC = "他のユーザーが作成したクイズ";
const RELATED_TOPICS_MODEL = "gpt-5-mini";

const relatedTopicsSchema = z.object({
  topics: z.array(z.string().min(1)).min(1).max(3),
});

function normalizeTopics(topics: string[]): string[] {
  return [...new Set(topics.map((topic) => topic.trim()).filter(Boolean))].slice(0, 3);
}

async function readTopicSuggestionCache(userId: string): Promise<string[] | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(topicSuggestionsCache)
    .where(eq(topicSuggestionsCache.userId, userId))
    .limit(1);

  if (!row) return null;
  if (Date.now() - row.cachedAt >= CACHE_TTL_MS) return null;

  return normalizeTopics(JSON.parse(row.topics) as string[]);
}

async function fetchRecentManualTopics(userId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({
      topic: sessions.topic,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        ne(sessions.topic, SHARED_TOPIC),
        or(eq(sessions.sourceType, "manual"), isNull(sessions.sourceType)),
      ),
    )
    .orderBy(desc(sessions.createdAt))
    .limit(6);

  return [...new Set(rows.map((row) => row.topic).filter(Boolean))].slice(0, 5);
}

export async function getRelatedTopicSuggestions(userId: string): Promise<string[]> {
  const cached = await readTopicSuggestionCache(userId);
  if (cached) return cached;

  const seedTopics = await fetchRecentManualTopics(userId);
  if (seedTopics.length === 0) {
    return [];
  }

  const prompt = [
    "あなたはプログラマー向け英語学習サイトの推薦アシスタントです。",
    "最近学習した技術トピックをもとに、次に学ぶと関連性が高い技術トピックを3件だけ提案してください。",
    "- 返す topic は短い技術名にすること",
    "- 日本語と英語が混ざってもよいが、自然な技術トピック名にすること",
    "- 元の入力をそのまま繰り返さないこと",
    `最近の学習トピック: ${seedTopics.join(", ")}`,
  ].join("\n");

  const parsed = await createOpenAIParsedText(
    prompt,
    RELATED_TOPICS_MODEL,
    relatedTopicsSchema,
    "related_topics_ja",
    { maxOutputTokens: 300 },
  );

  const topics = normalizeTopics(parsed.topics);
  if (topics.length === 0) {
    return [];
  }

  const db = getDb();
  const cachedAt = Date.now();
  await db
    .insert(topicSuggestionsCache)
    .values({
      userId,
      topics: JSON.stringify(topics),
      cachedAt,
    })
    .onConflictDoUpdate({
      target: topicSuggestionsCache.userId,
      set: {
        topics: JSON.stringify(topics),
        cachedAt,
      },
    });

  return topics;
}
