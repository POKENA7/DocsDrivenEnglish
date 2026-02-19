CREATE TABLE `review_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`question_id` text NOT NULL,
	`next_review_at` integer NOT NULL,
	`wrong_count` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_queue_user_id_question_id_unique` ON `review_queue` (`user_id`,`question_id`);