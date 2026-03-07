import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable("sessions", {
  sessionId: text("session_id").primaryKey(),
  userId: text("user_id").notNull(),
  topic: text("topic").notNull(),
  mode: text("mode").notNull(),
  questionIdsJson: text("question_ids_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const questions = sqliteTable("questions", {
  questionId: text("question_id").primaryKey(),
  userId: text("user_id").notNull(),
  mode: text("mode").notNull(),
  topic: text("topic").notNull(),
  prompt: text("prompt").notNull(),
  choicesJson: text("choices_json").notNull(),
  correctIndex: integer("correct_index").notNull(),
  explanation: text("explanation").notNull(),
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

export const reviewQueue = sqliteTable(
  "review_queue",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    questionId: text("question_id").notNull(),
    nextReviewAt: integer("next_review_at").notNull(), // Unix timestamp ms
    wrongCount: integer("wrong_count").notNull().default(1),
    intervalDays: integer("interval_days").notNull().default(1), // スペースド・リペティション用インターバル（日数）
  },
  (table) => [unique().on(table.userId, table.questionId)],
);
