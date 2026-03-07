"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type TopicSuggestionSelectionContextValue = {
  topic: string;
  articleKey: string | null;
  setManualTopic: (topic: string) => void;
  selectManualSuggestion: (topic: string) => void;
  selectTrendSuggestion: (title: string, articleKey: string) => void;
};

const TopicSuggestionSelectionContext = createContext<TopicSuggestionSelectionContextValue | null>(
  null,
);

export function TopicSuggestionSelectionProvider({ children }: { children: ReactNode }) {
  const [topic, setTopic] = useState("");
  const [articleKey, setArticleKey] = useState<string | null>(null);

  const value = useMemo<TopicSuggestionSelectionContextValue>(
    () => ({
      topic,
      articleKey,
      setManualTopic(nextTopic: string) {
        setTopic(nextTopic);
        setArticleKey(null);
      },
      selectManualSuggestion(nextTopic: string) {
        setTopic(nextTopic);
        setArticleKey(null);
      },
      selectTrendSuggestion(title: string, nextArticleKey: string) {
        setTopic(title);
        setArticleKey(nextArticleKey);
      },
    }),
    [articleKey, topic],
  );

  return (
    <TopicSuggestionSelectionContext.Provider value={value}>
      {children}
    </TopicSuggestionSelectionContext.Provider>
  );
}

export function useTopicSuggestionSelection() {
  const context = useContext(TopicSuggestionSelectionContext);
  if (!context) {
    throw new Error("TopicSuggestionSelectionProvider が必要です");
  }
  return context;
}
