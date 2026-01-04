import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const studySessions = sqliteTable("study_sessions", {
  sessionId: text("session_id").primaryKey(),
  userId: text("user_id"),
  inputUrl: text("input_url").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceQuoteText: text("source_quote_text").notNull(),
  title: text("title"),
  fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
  mode: text("mode").notNull(),
  plannedCount: integer("planned_count").notNull(),
  actualCount: integer("actual_count").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
});

export const questions = sqliteTable("questions", {
  questionId: text("question_id").primaryKey(),
  sessionId: text("session_id").notNull(),
  mode: text("mode").notNull(),
  prompt: text("prompt").notNull(),
  choicesJson: text("choices_json").notNull(),
  correctIndex: integer("correct_index").notNull(),
  explanation: text("explanation").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceQuoteText: text("source_quote_text").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const attempts = sqliteTable("attempts", {
  attemptId: text("attempt_id").primaryKey(),
  sessionId: text("session_id").notNull(),
  questionId: text("question_id").notNull(),
  userId: text("user_id"),
  selectedIndex: integer("selected_index").notNull(),
  isCorrect: integer("is_correct", { mode: "boolean" }).notNull(),
  explanation: text("explanation"),
  answeredAt: integer("answered_at", { mode: "timestamp_ms" }).notNull(),
});
