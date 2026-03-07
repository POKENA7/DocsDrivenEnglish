CREATE TABLE `hn_trend_cache` (
	`id` integer PRIMARY KEY NOT NULL,
	`articles` text NOT NULL,
	`cached_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `topic_suggestions_cache` (
	`user_id` text PRIMARY KEY NOT NULL,
	`topics` text NOT NULL,
	`cached_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `questions` ADD `source_type` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `source_type` text;--> statement-breakpoint