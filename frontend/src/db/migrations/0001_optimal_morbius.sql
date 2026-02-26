ALTER TABLE `study_sessions` ADD `topic` text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE `study_sessions` DROP COLUMN `input_url`;--> statement-breakpoint
ALTER TABLE `study_sessions` DROP COLUMN `source_url`;--> statement-breakpoint
ALTER TABLE `study_sessions` DROP COLUMN `source_quote_text`;--> statement-breakpoint
ALTER TABLE `study_sessions` DROP COLUMN `title`;--> statement-breakpoint
ALTER TABLE `study_sessions` DROP COLUMN `fetched_at`;--> statement-breakpoint
ALTER TABLE `questions` DROP COLUMN `source_url`;--> statement-breakpoint
ALTER TABLE `questions` DROP COLUMN `source_quote_text`;