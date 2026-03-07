"use client";

import type { HnTrendArticle } from "@/server/suggestions/hn-trends";

import { useTopicSuggestionSelection } from "./TopicSuggestionSelectionContext";

export default function TopicSuggestionsClient(props: {
  relatedTopics: string[];
  trendArticles: HnTrendArticle[];
}) {
  const { relatedTopics, trendArticles } = props;
  const { articleKey, selectManualSuggestion, selectTrendSuggestion } =
    useTopicSuggestionSelection();

  if (relatedTopics.length === 0 && trendArticles.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-4 rounded-lg border border-border/70 bg-muted/30 p-4">
      <div>
        <p className="text-xs font-semibold tracking-tight text-muted-foreground">
          おすすめトピック
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          気になるチップを押すと入力欄に反映されます。
        </p>
      </div>

      {relatedTopics.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">関連技術</h2>
          <div className="flex flex-wrap gap-2">
            {relatedTopics.map((topic) => (
              <button
                key={topic}
                type="button"
                className="rounded-full border border-border bg-background px-3 py-1.5 text-sm transition-colors hover:border-primary hover:text-primary"
                onClick={() => selectManualSuggestion(topic)}
              >
                {topic}
              </button>
            ))}
          </div>
        </section>
      )}

      {trendArticles.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">トレンド</h2>
          <div className="flex flex-wrap gap-2">
            {trendArticles.map((article) => {
              const isSelected = articleKey === article.articleKey;
              return (
                <button
                  key={article.articleKey}
                  type="button"
                  className={`rounded-full border px-3 py-1.5 text-left text-sm transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background hover:border-primary hover:text-primary"
                  }`}
                  onClick={() => selectTrendSuggestion(article.title, article.articleKey)}
                >
                  {article.title}
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
