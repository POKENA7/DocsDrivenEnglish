import { auth } from "@clerk/nextjs/server";

import { getHnTrendArticles } from "@/server/suggestions/hn-trends";
import { getRelatedTopicSuggestions } from "@/server/suggestions/related-topics";

import TopicSuggestionsClient from "./TopicSuggestionsClient";

export default async function TopicSuggestions() {
  const { userId } = await auth();
  const [relatedTopics, trendArticles] = await Promise.all([
    userId ? getRelatedTopicSuggestions(userId) : Promise.resolve([]),
    getHnTrendArticles(),
  ]);

  return <TopicSuggestionsClient relatedTopics={relatedTopics} trendArticles={trendArticles} />;
}

export function TopicSuggestionsFallback() {
  return (
    <div className="mt-4 rounded-lg border border-border/70 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
      おすすめトピックを読み込み中...
    </div>
  );
}
