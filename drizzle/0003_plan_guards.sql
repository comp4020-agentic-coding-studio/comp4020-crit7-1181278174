-- Rules a plan must never break, kept by the database itself so no code path
-- can skip them. A semester is numbered year * 2 + (session = 'S2'); a plan
-- covers term_count semesters from its start.
CREATE TRIGGER `plan_courses_within_plan_insert`
BEFORE INSERT ON `plan_courses`
WHEN (
  SELECT (NEW.`year` * 2 + (NEW.`session` = 'S2')) - (`start_year` * 2 + (`start_session` = 'S2'))
  FROM `plans` WHERE `id` = NEW.`plan_id`
) NOT BETWEEN 0 AND (SELECT `term_count` - 1 FROM `plans` WHERE `id` = NEW.`plan_id`)
BEGIN
  SELECT RAISE(ABORT, 'semester outside the plan');
END;
--> statement-breakpoint
CREATE TRIGGER `plan_courses_within_plan_update`
BEFORE UPDATE OF `year`, `session` ON `plan_courses`
WHEN (
  SELECT (NEW.`year` * 2 + (NEW.`session` = 'S2')) - (`start_year` * 2 + (`start_session` = 'S2'))
  FROM `plans` WHERE `id` = NEW.`plan_id`
) NOT BETWEEN 0 AND (SELECT `term_count` - 1 FROM `plans` WHERE `id` = NEW.`plan_id`)
BEGIN
  SELECT RAISE(ABORT, 'semester outside the plan');
END;
--> statement-breakpoint
CREATE TRIGGER `plan_courses_read_only_insert`
BEFORE INSERT ON `plan_courses`
WHEN (SELECT `read_only` FROM `plans` WHERE `id` = NEW.`plan_id`) = 1
BEGIN
  SELECT RAISE(ABORT, 'this plan is read-only');
END;
--> statement-breakpoint
CREATE TRIGGER `plan_courses_read_only_update`
BEFORE UPDATE ON `plan_courses`
WHEN (SELECT `read_only` FROM `plans` WHERE `id` = OLD.`plan_id`) = 1
BEGIN
  SELECT RAISE(ABORT, 'this plan is read-only');
END;
--> statement-breakpoint
CREATE TRIGGER `plan_courses_read_only_delete`
BEFORE DELETE ON `plan_courses`
WHEN (SELECT `read_only` FROM `plans` WHERE `id` = OLD.`plan_id`) = 1
BEGIN
  SELECT RAISE(ABORT, 'this plan is read-only');
END;
--> statement-breakpoint
CREATE TRIGGER `plans_read_only_update`
BEFORE UPDATE ON `plans`
WHEN OLD.`read_only` = 1
BEGIN
  SELECT RAISE(ABORT, 'this plan is read-only');
END;
