import "server-only";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { stripUrlsFromText } from "@/app/(features)/learn/_utils/stripUrlsFromText";
import { getDb } from "@/db/client";
import { hnTrendCache } from "@/db/schema";
import { ApiError } from "@/server/quiz/errors";

const HN_TOP_STORIES_URL = "https://hacker-news.firebaseio.com/v0/topstories.json";
const HN_ITEM_URL = "https://hacker-news.firebaseio.com/v0/item";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_ID = 1;
const ARTICLE_KEY_REGEX = /^hn-(\d+)-(\d+)$/;
const MAX_ARTICLE_TEXT_LENGTH = 12_000;

const hnItemSchema = z.object({
  type: z.string().optional(),
  title: z.string().min(1),
  url: z.string().url().optional(),
});

const trendArticleSchema = z.object({
  articleKey: z.string(),
  title: z.string().min(1),
  url: z.string().url(),
});

const trendArticlesSchema = z.array(trendArticleSchema);

export type HnTrendArticle = z.infer<typeof trendArticleSchema>;

function buildArticleKey(cachedAt: number, index: number): string {
  return `hn-${cachedAt}-${index}`;
}

function parseArticleKey(articleKey: string): { cachedAt: number; index: number } | null {
  const match = ARTICLE_KEY_REGEX.exec(articleKey);
  if (!match) return null;

  return {
    cachedAt: Number(match[1]),
    index: Number(match[2]),
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "DocsDrivenEnglish/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractArticleText(html: string): string {
  const withoutScripts = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ");

  const withParagraphBreaks = withoutScripts.replace(
    /<\/(p|div|section|article|li|h1|h2|h3|h4|h5|h6|pre|code|blockquote|br)>/gi,
    "\n",
  );

  const plainText = withParagraphBreaks.replace(/<[^>]+>/g, " ");
  const normalized = decodeHtmlEntities(plainText)
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ ]{2,}/g, " ")
    .trim();

  return stripUrlsFromText(normalized).slice(0, MAX_ARTICLE_TEXT_LENGTH).trim();
}

async function refreshHnTrendArticles(): Promise<HnTrendArticle[]> {
  const topStoryIds = await fetchJson<number[]>(HN_TOP_STORIES_URL);
  const storyIds = topStoryIds.slice(0, 10);
  const items = await Promise.all(
    storyIds.map(async (id) => fetchJson<unknown>(`${HN_ITEM_URL}/${id}.json`)),
  );

  const cachedAt = Date.now();
  const articles = items
    .map((item) => hnItemSchema.safeParse(item))
    .filter((result) => result.success)
    .map((result) => result.data)
    .filter((item) => item.type === "story" && item.url)
    .slice(0, 3)
    .map((item, index) => ({
      articleKey: buildArticleKey(cachedAt, index),
      title: item.title,
      url: item.url!,
    }));

  if (articles.length === 0) {
    throw new Error("Hacker News trend articles were empty");
  }

  const db = getDb();
  await db
    .insert(hnTrendCache)
    .values({
      id: CACHE_ID,
      articles: JSON.stringify(articles),
      cachedAt,
    })
    .onConflictDoUpdate({
      target: hnTrendCache.id,
      set: {
        articles: JSON.stringify(articles),
        cachedAt,
      },
    });

  return articles;
}

async function readTrendCache(): Promise<{ articles: HnTrendArticle[]; cachedAt: number } | null> {
  const db = getDb();
  const [row] = await db.select().from(hnTrendCache).where(eq(hnTrendCache.id, CACHE_ID)).limit(1);
  if (!row) return null;

  return {
    articles: trendArticlesSchema.parse(JSON.parse(row.articles) as unknown),
    cachedAt: row.cachedAt,
  };
}

export async function getHnTrendArticles(): Promise<HnTrendArticle[]> {
  const cache = await readTrendCache();
  if (cache && Date.now() - cache.cachedAt < CACHE_TTL_MS) {
    return cache.articles;
  }

  return refreshHnTrendArticles();
}

async function resolveHnTrendArticle(articleKey: string): Promise<HnTrendArticle> {
  const parsedKey = parseArticleKey(articleKey);
  if (!parsedKey) {
    throw new ApiError("BAD_REQUEST", "articleKey が不正です");
  }

  const cache = await readTrendCache();
  if (!cache || cache.cachedAt !== parsedKey.cachedAt) {
    throw new ApiError("BAD_REQUEST", "選択されたトレンド記事が見つかりませんでした");
  }

  const article = cache.articles[parsedKey.index];
  if (!article || article.articleKey !== articleKey) {
    throw new ApiError("BAD_REQUEST", "選択されたトレンド記事が見つかりませんでした");
  }

  return article;
}

export async function fetchHnTrendArticleContent(articleKey: string): Promise<{
  title: string;
  articleKey: string;
  sourceUrl: string;
  content: string;
}> {
  const article = await resolveHnTrendArticle(articleKey);
  const response = await fetch(article.url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "DocsDrivenEnglish/1.0",
    },
  });

  if (!response.ok) {
    throw new ApiError("INTERNAL", "トレンド記事の取得に失敗しました");
  }

  const html = await response.text();
  const content = extractArticleText(html);
  if (!content) {
    throw new ApiError("INTERNAL", "トレンド記事の本文抽出に失敗しました");
  }

  return {
    title: article.title,
    articleKey: article.articleKey,
    sourceUrl: article.url,
    content,
  };
}
