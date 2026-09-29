CREATE TABLE `major_blocks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`major_code` text NOT NULL,
	`position` integer NOT NULL,
	`text` text NOT NULL,
	FOREIGN KEY (`major_code`) REFERENCES `majors`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `major_blocks_position` ON `major_blocks` (`major_code`,`position`);--> statement-breakpoint
CREATE TABLE `major_courses` (
	`block_id` integer NOT NULL,
	`position` integer NOT NULL,
	`course_code` text NOT NULL,
	`title` text NOT NULL,
	`units` text,
	PRIMARY KEY(`block_id`, `position`),
	FOREIGN KEY (`block_id`) REFERENCES `major_blocks`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "major_courses_code" CHECK("major_courses"."course_code" GLOB '[A-Z][A-Z][A-Z][A-Z][0-9][0-9][0-9][0-9]')
);
--> statement-breakpoint
CREATE TABLE `majors` (
	`code` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`requirements_text` text NOT NULL,
	`source_url` text NOT NULL,
	`fetched_at` text NOT NULL
);
