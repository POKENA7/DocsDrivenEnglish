import "server-only";

import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom/worker";
import TurndownService from "turndown";

import { ApiError } from "./errors";

export type ExtractedDocument = {
  title: string | null;
  markdown: string;
  sourceUrl: string;
  sourceQuoteText: string;
};

const FETCH_TIMEOUT_MS = 5_000;
const MAX_QUOTE_CHARS = 300;

export function parseHttpUrl(input: string): URL {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new ApiError("BAD_REQUEST", 400, "URL を入力してください");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new ApiError("BAD_REQUEST", 400, "URL が不正です");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ApiError("BAD_REQUEST", 400, "URL は http/https のみ対応しています");
  }

  return url;
}

export async function fetchHtml(url: URL): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        "user-agent": "DocsDrivenEnglish/0.1",
        accept: "text/html,application/xhtml+xml",
      },
    });

    if (!res.ok) {
      throw new ApiError(
        "UPSTREAM_FETCH_FAILED",
        502,
        `ドキュメントの取得に失敗しました（HTTP ${res.status}）`,
      );
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      throw new ApiError(
        "UPSTREAM_FETCH_FAILED",
        502,
        "HTML のページではないため読み込めませんでした",
      );
    }

    return await res.text();
  } catch (e) {
    if (e instanceof ApiError) throw e;

    const hasName = (value: unknown): value is { name: unknown } => {
      return typeof value === "object" && value !== null && "name" in value;
    };

    const isAbort =
      (e instanceof Error && e.name === "AbortError") || (hasName(e) && e.name === "AbortError");

    if (isAbort) {
      throw new ApiError(
        "UPSTREAM_FETCH_FAILED",
        502,
        "ドキュメントの取得がタイムアウトしました。時間をおいて再試行してください。",
      );
    }

    throw new ApiError(
      "UPSTREAM_FETCH_FAILED",
      502,
      "ドキュメントの取得に失敗しました。URL が公開されているか確認してください。",
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildTurndown(): TurndownService {
  const service = new TurndownService({
    codeBlockStyle: "fenced",
    headingStyle: "atx",
  });

  service.addRule("fencedCodeBlock", {
    filter: (node) =>
      node.nodeName === "PRE" &&
      (node.firstChild?.nodeName === "CODE" || node.textContent !== null),
    replacement: (_content, node) => {
      const text = node.textContent ?? "";
      const cleaned = text.replace(/\n+$/g, "");
      return `\n\n\`\`\`\n${cleaned}\n\`\`\`\n\n`;
    },
  });

  return service;
}

function makeQuoteFromExtract(excerpt: string | null | undefined, html: string): string {
  const fromExcerpt = (excerpt ?? "").trim();
  if (fromExcerpt.length > 0) {
    return fromExcerpt.slice(0, MAX_QUOTE_CHARS);
  }

  const { document } = parseHTML(html);
  const paragraphs = Array.from(document.querySelectorAll("p"));
  for (const p of paragraphs) {
    const text = (p.textContent ?? "").trim().replace(/\s+/g, " ");
    if (text.length > 0) {
      return text.slice(0, MAX_QUOTE_CHARS);
    }
  }

  const fallback = (document.body?.textContent ?? "").trim().replace(/\s+/g, " ");
  return fallback.slice(0, MAX_QUOTE_CHARS);
}

export function extractDocument(html: string, url: URL): ExtractedDocument {
  const { document } = parseHTML(html);

  const reader = new Readability(document, {
    charThreshold: 100,
  });

  const parsed = reader.parse();
  if (!parsed || !parsed.content) {
    throw new ApiError("UPSTREAM_PARSE_FAILED", 502, "本文の抽出に失敗しました");
  }

  const turndown = buildTurndown();
  const markdown = turndown.turndown(parsed.content).trim();
  if (!markdown) {
    throw new ApiError("UPSTREAM_PARSE_FAILED", 502, "本文の抽出に失敗しました");
  }

  const sourceQuoteText = makeQuoteFromExtract(parsed.excerpt, parsed.content);

  return {
    title: parsed.title ?? null,
    markdown,
    sourceUrl: url.toString(),
    sourceQuoteText,
  };
}

export async function fetchAndExtractDocument(inputUrl: string): Promise<ExtractedDocument> {
  const url = parseHttpUrl(inputUrl);
  const html = await fetchHtml(url);
  return extractDocument(html, url);
}
