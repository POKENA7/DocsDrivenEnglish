CREATE TABLE `attempts` (
	`attempt_id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`question_id` text NOT NULL,
	`user_id` text,
	`selected_index` integer NOT NULL,
	`is_correct` integer NOT NULL,
	`explanation` text,
	`answered_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`question_id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`mode` text NOT NULL,
	`prompt` text NOT NULL,
	`choices_json` text NOT NULL,
	`correct_index` integer NOT NULL,
	`explanation` text NOT NULL,
	`source_url` text NOT NULL,
	`source_quote_text` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `study_sessions` (
	`session_id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`input_url` text NOT NULL,
	`source_url` text NOT NULL,
	`source_quote_text` text NOT NULL,
	`title` text,
	`fetched_at` integer NOT NULL,
	`mode` text NOT NULL,
	`planned_count` integer NOT NULL,
	`actual_count` integer NOT NULL,
	`created_at` integer NOT NULL,
	`completed_at` integer
);
