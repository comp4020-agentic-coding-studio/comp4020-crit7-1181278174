import { sql } from "drizzle-orm";
import { check, index, int, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// The schema is the ground truth for the database. To change it: edit here,
// run `pnpm db:generate` to turn the diff into a migration under drizzle/,
// and commit both — the migration applies automatically when the server
// boots (see src/lib/db.ts), locally and deployed. Never edit the database
// by hand: state on the deployed volume outlives every deploy.
//
// Two kinds of table. The catalogue (courses, offerings, requisite_options,
// incompatibilities) is P&C's, loaded from data/ at every boot. Plans and
// plan_courses are what people make, and nothing but their own forms writes
// them. The rules a plan must never break (a course twice, a malformed code, a
// semester outside the plan, a change to a read-only plan) are enforced here
// and in the triggers of drizzle/0002, not only in the app.

const courseCode = (column: unknown) =>
  sql`${column} GLOB '[A-Z][A-Z][A-Z][A-Z][0-9][0-9][0-9][0-9]'`;

export const SESSIONS = ["S1", "S2"] as const;
export type Session = (typeof SESSIONS)[number];

export const courses = sqliteTable(
  "courses",
  {
    code: text().primaryKey(),
    title: text().notNull(),
    units: int().notNull(),
    subject: text().notNull(),
    level: int().notNull(),
    // the requisite sentence as P&C prints it, and the year of the page it came from
    requisiteText: text("requisite_text").notNull(),
    rulesYear: int("rules_year").notNull(),
    // sentences from requisite_text this app cannot check, word for word
    manual: text({ mode: "json" }).$type<string[]>().notNull(),
    // how an unclear sentence was read
    reading: text(),
    sourceUrl: text("source_url").notNull(),
    fetchedAt: text("fetched_at").notNull(),
  },
  (t) => [check("courses_code", courseCode(t.code))],
);

export const offerings = sqliteTable(
  "offerings",
  {
    courseCode: text("course_code")
      .notNull()
      .references(() => courses.code),
    year: int().notNull(),
    session: text({ enum: SESSIONS }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.courseCode, t.year, t.session] }),
    check("offerings_session", sql`${t.session} IN ('S1', 'S2')`),
  ],
);

// One row per option. Options in the same clause are alternatives (any one
// will do); every clause of a course must be met. An option is either a
// course or a number of units, never both.
export const requisiteOptions = sqliteTable(
  "requisite_options",
  {
    id: int().primaryKey({ autoIncrement: true }),
    courseCode: text("course_code")
      .notNull()
      .references(() => courses.code),
    clause: int().notNull(),
    requiredCode: text("required_code"),
    // the required course may be taken in the same semester
    concurrent: int({ mode: "boolean" }).notNull().default(false),
    minUnits: int("min_units"),
    subjects: text({ mode: "json" }).$type<string[]>(),
    levels: text({ mode: "json" }).$type<number[]>(),
    excluding: text({ mode: "json" }).$type<string[]>(),
  },
  (t) => [
    check("requisite_options_kind", sql`(${t.requiredCode} IS NULL) <> (${t.minUnits} IS NULL)`),
    index("requisite_options_required").on(t.requiredCode),
  ],
);

export const incompatibilities = sqliteTable(
  "incompatibilities",
  {
    courseCode: text("course_code")
      .notNull()
      .references(() => courses.code),
    otherCode: text("other_code").notNull(),
  },
  (t) => [primaryKey({ columns: [t.courseCode, t.otherCode] })],
);

export const plans = sqliteTable(
  "plans",
  {
    id: text().primaryKey(),
    name: text().notNull(),
    startYear: int("start_year").notNull(),
    startSession: text("start_session", { enum: SESSIONS }).notNull(),
    termCount: int("term_count").notNull(),
    readOnly: int("read_only", { mode: "boolean" }).notNull().default(false),
    // what the last change did, shown at the top of the plan
    lastChange: text("last_change"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    check("plans_name", sql`length(${t.name}) BETWEEN 1 AND 80`),
    check("plans_start_session", sql`${t.startSession} IN ('S1', 'S2')`),
    check("plans_term_count", sql`${t.termCount} BETWEEN 1 AND 16`),
  ],
);

// A course outside the catalogue may go in a plan: its units count, and the
// page says it was not checked. So course_code has no foreign key.
export const planCourses = sqliteTable(
  "plan_courses",
  {
    planId: text("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    courseCode: text("course_code").notNull(),
    year: int().notNull(),
    session: text({ enum: SESSIONS }).notNull(),
    units: int().notNull(),
    addedAt: text("added_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    primaryKey({ columns: [t.planId, t.courseCode] }),
    check("plan_courses_code", courseCode(t.courseCode)),
    check("plan_courses_session", sql`${t.session} IN ('S1', 'S2')`),
    check("plan_courses_units", sql`${t.units} BETWEEN 1 AND 24`),
  ],
);

// The computing majors, loaded from data/majors.json at every boot like the
// catalogue. A block is one paragraph of P&C's requirements in its own words;
// its courses are the lines listed under it. Nothing here is user data.
export const majors = sqliteTable("majors", {
  code: text().primaryKey(),
  title: text().notNull(),
  // the whole requirements section as plain text, which every block is held to
  requirementsText: text("requirements_text").notNull(),
  sourceUrl: text("source_url").notNull(),
  fetchedAt: text("fetched_at").notNull(),
});

export const majorBlocks = sqliteTable(
  "major_blocks",
  {
    id: int().primaryKey({ autoIncrement: true }),
    majorCode: text("major_code")
      .notNull()
      .references(() => majors.code, { onDelete: "cascade" }),
    position: int().notNull(),
    text: text().notNull(),
  },
  (t) => [uniqueIndex("major_blocks_position").on(t.majorCode, t.position)],
);

export const majorCourses = sqliteTable(
  "major_courses",
  {
    blockId: int("block_id")
      .notNull()
      .references(() => majorBlocks.id, { onDelete: "cascade" }),
    position: int().notNull(),
    courseCode: text("course_code").notNull(),
    title: text().notNull(),
    // as P&C prints it: "6 units", "6+6 units", or nothing
    units: text(),
  },
  (t) => [
    primaryKey({ columns: [t.blockId, t.position] }),
    check("major_courses_code", courseCode(t.courseCode)),
  ],
);

export type CourseRow = typeof courses.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type PlanCourse = typeof planCourses.$inferSelect;
