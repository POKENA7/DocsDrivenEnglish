CREATE TABLE `user_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`daily_goal_count` integer NOT NULL DEFAULT 10,
	`daily_review_count` integer NOT NULL DEFAULT 2
);
