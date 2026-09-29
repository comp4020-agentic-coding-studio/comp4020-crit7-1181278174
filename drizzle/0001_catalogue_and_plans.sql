CREATE TABLE `courses` (
	`code` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`units` integer NOT NULL,
	`subject` text NOT NULL,
	`level` integer NOT NULL,
	`requisite_text` text NOT NULL,
	`rules_year` integer NOT NULL,
	`manual` text NOT NULL,
	`reading` text,
	`source_url` text NOT NULL,
	`fetched_at` text NOT NULL,
	CONSTRAINT "courses_code" CHECK("courses"."code" GLOB '[A-Z][A-Z][A-Z][A-Z][0-9][0-9][0-9][0-9]')
);
--> statement-breakpoint
CREATE TABLE `incompatibilities` (
	`course_code` text NOT NULL,
	`other_code` text NOT NULL,
	PRIMARY KEY(`course_code`, `other_code`),
	FOREIGN KEY (`course_code`) REFERENCES `courses`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `offerings` (
	`course_code` text NOT NULL,
	`year` integer NOT NULL,
	`session` text NOT NULL,
	PRIMARY KEY(`course_code`, `year`, `session`),
	FOREIGN KEY (`course_code`) REFERENCES `courses`(`code`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "offerings_session" CHECK("offerings"."session" IN ('S1', 'S2'))
);
--> statement-breakpoint
CREATE TABLE `plan_courses` (
	`plan_id` text NOT NULL,
	`course_code` text NOT NULL,
	`year` integer NOT NULL,
	`session` text NOT NULL,
	`units` integer NOT NULL,
	`added_at` text DEFAULT (datetime('now')) NOT NULL,
	PRIMARY KEY(`plan_id`, `course_code`),
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "plan_courses_code" CHECK("plan_courses"."course_code" GLOB '[A-Z][A-Z][A-Z][A-Z][0-9][0-9][0-9][0-9]'),
	CONSTRAINT "plan_courses_session" CHECK("plan_courses"."session" IN ('S1', 'S2')),
	CONSTRAINT "plan_courses_units" CHECK("plan_courses"."units" BETWEEN 1 AND 24)
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`start_year` integer NOT NULL,
	`start_session` text NOT NULL,
	`term_count` integer NOT NULL,
	`read_only` integer DEFAULT false NOT NULL,
	`last_change` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	CONSTRAINT "plans_name" CHECK(length("plans"."name") BETWEEN 1 AND 80),
	CONSTRAINT "plans_start_session" CHECK("plans"."start_session" IN ('S1', 'S2')),
	CONSTRAINT "plans_term_count" CHECK("plans"."term_count" BETWEEN 1 AND 16)
);
--> statement-breakpoint
CREATE TABLE `requisite_options` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_code` text NOT NULL,
	`clause` integer NOT NULL,
	`required_code` text,
	`concurrent` integer DEFAULT false NOT NULL,
	`min_units` integer,
	`subjects` text,
	`levels` text,
	`excluding` text,
	FOREIGN KEY (`course_code`) REFERENCES `courses`(`code`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "requisite_options_kind" CHECK(("requisite_options"."required_code" IS NULL) <> ("requisite_options"."min_units" IS NULL))
);
--> statement-breakpoint
CREATE INDEX `requisite_options_required` ON `requisite_options` (`required_code`);