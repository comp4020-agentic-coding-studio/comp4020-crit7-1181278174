import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { catalogue } from "./catalogue";
import {
  checkPlan,
  describeChange,
  type PlacedCourse,
  type PlanCheck,
  type Session,
  shortLabel,
  type Term,
} from "./check";
import { db } from "./db";
import { bus } from "./events";
import { type Plan, planCourses, plans } from "./schema";

export type PlanWithCourses = Plan & { courses: PlacedCourse[] };

// Why a change was refused, in words the plan page can show.
export const REFUSALS = {
  duplicate: "is already in this plan.",
  outside: "That semester is not part of this plan.",
  "read-only": "The example plan can't be changed. Copy it to make your own.",
  invalid: "That doesn't look like a course code (four capital letters and four digits).",
  missing: "There is no plan at that address.",
  absent: "is not in this plan.",
} as const;
export type Refusal = keyof typeof REFUSALS;

export class PlanError extends Error {
  constructor(readonly refusal: Refusal) {
    super(refusal);
  }
}

// SQLite enforces the plan rules (primary key, CHECKs, the triggers in
// drizzle/0003); this turns its error into the refusal the page shows.
function refusalFrom(error: unknown): Refusal | undefined {
  const cause = (error as { cause?: unknown }).cause ?? error;
  const { code = "", message = "" } = cause as { code?: string; message?: string };
  if (code === "SQLITE_CONSTRAINT_PRIMARYKEY") return "duplicate";
  if (message.includes("read-only")) return "read-only";
  if (message.includes("outside the plan")) return "outside";
  if (code === "SQLITE_CONSTRAINT_CHECK") return "invalid";
  if (code === "SQLITE_CONSTRAINT_FOREIGNKEY") return "missing";
  return undefined;
}

function guarded<T>(work: () => T): T {
  try {
    return work();
  } catch (error) {
    const refusal = refusalFrom(error);
    if (refusal) throw new PlanError(refusal);
    throw error;
  }
}

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
const newPlanId = (): string => Array.from(randomBytes(12), (b) => ALPHABET[b % 32]).join("");

export const EXAMPLE_ID = "example";
export const COURSE_CODE = /^[A-Z]{4}\d{4}$/;

export function getPlan(id: string): PlanWithCourses | undefined {
  const plan = db.select().from(plans).where(eq(plans.id, id)).get();
  if (!plan) return undefined;
  const placed = db
    .select({
      code: planCourses.courseCode,
      year: planCourses.year,
      session: planCourses.session,
      units: planCourses.units,
    })
    .from(planCourses)
    .where(eq(planCourses.planId, id))
    .all();
  return { ...plan, courses: placed };
}

export const check = (plan: PlanWithCourses, now = new Date()): PlanCheck =>
  checkPlan(plan, catalogue, now);

export function createPlan(input: {
  name: string;
  startYear: number;
  startSession: Session;
  termCount: number;
}): string {
  const id = newPlanId();
  guarded(() => db.insert(plans).values({ id, ...input }).run());
  return id;
}

export function copyPlan(fromId: string): string {
  const from = getPlan(fromId);
  if (!from) throw new PlanError("missing");
  const id = newPlanId();
  guarded(() =>
    db.transaction((tx) => {
      tx.insert(plans)
        .values({
          id,
          name: `${from.name} (copy)`.slice(0, 80),
          startYear: from.startYear,
          startSession: from.startSession,
          termCount: from.termCount,
          lastChange: `Copied from “${from.name}”.`,
        })
        .run();
      for (const c of from.courses) tx.insert(planCourses).values({ planId: id, courseCode: c.code, ...c }).run();
    }),
  );
  return id;
}

// Every change to a plan goes through here: it runs in one transaction, says
// what it did to the plan's problems, and tells every open page of that plan.
function change(planId: string, action: string, apply: () => void, by?: string): void {
  const before = getPlan(planId);
  if (!before) throw new PlanError("missing");
  guarded(() =>
    db.transaction((tx) => {
      apply();
      const after = getPlan(planId);
      if (!after) throw new PlanError("missing");
      tx.update(plans)
        .set({ lastChange: describeChange(action, check(before), check(after)), updatedAt: sql`(datetime('now'))` })
        .where(eq(plans.id, planId))
        .run();
    }),
  );
  bus.emit("plan", { id: planId, by });
}

export function addCourse(planId: string, code: string, term: Term, by?: string): void {
  if (!COURSE_CODE.test(code)) throw new PlanError("invalid");
  const units = catalogue.courses.get(code)?.units ?? 6;
  change(
    planId,
    `Added ${code} to ${shortLabel(term)}.`,
    () => db.insert(planCourses).values({ planId, courseCode: code, ...term, units }).run(),
    by,
  );
}

function mustHold(planId: string, code: string): void {
  const plan = getPlan(planId);
  if (!plan) throw new PlanError("missing");
  if (!plan.courses.some((c) => c.code === code)) throw new PlanError("absent");
}

export function moveCourse(planId: string, code: string, term: Term, by?: string): void {
  mustHold(planId, code);
  change(
    planId,
    `Moved ${code} to ${shortLabel(term)}.`,
    () =>
      db
        .update(planCourses)
        .set(term)
        .where(and(eq(planCourses.planId, planId), eq(planCourses.courseCode, code)))
        .run(),
    by,
  );
}

export function removeCourse(planId: string, code: string, by?: string): void {
  mustHold(planId, code);
  change(
    planId,
    `Removed ${code}.`,
    () =>
      db
        .delete(planCourses)
        .where(and(eq(planCourses.planId, planId), eq(planCourses.courseCode, code)))
        .run(),
    by,
  );
}

// A read-only plan anyone can open, with two problems in it: COMP4712 is not
// offered in 2027, and COMP3620 needs COMP2620, which the plan lacks.
const EXAMPLE: { name: string; start: Term; termCount: number; courses: [string, number, Session][] } = {
  name: "Example: a computing student who started in 2025",
  start: { year: 2025, session: "S1" },
  termCount: 8,
  courses: [
    ["COMP1100", 2025, "S1"],
    ["MATH1005", 2025, "S1"],
    ["COMP1110", 2025, "S2"],
    ["COMP1600", 2025, "S2"],
    ["COMP2100", 2026, "S1"],
    ["COMP2300", 2026, "S1"],
    ["COMP2120", 2026, "S2"],
    ["COMP2310", 2026, "S2"],
    ["COMP3900", 2026, "S2"],
    ["COMP2400", 2027, "S1"],
    ["COMP3310", 2027, "S1"],
    ["COMP4712", 2027, "S1"],
    ["COMP3600", 2027, "S2"],
    ["COMP4020", 2027, "S2"],
    ["COMP3620", 2028, "S1"],
    ["COMP4300", 2028, "S1"],
  ],
};

function seedExample(): void {
  if (getPlan(EXAMPLE_ID)) return;
  db.transaction((tx) => {
    tx.insert(plans)
      .values({
        id: EXAMPLE_ID,
        name: EXAMPLE.name,
        startYear: EXAMPLE.start.year,
        startSession: EXAMPLE.start.session,
        termCount: EXAMPLE.termCount,
      })
      .run();
    for (const [code, year, session] of EXAMPLE.courses) {
      const units = catalogue.courses.get(code)?.units ?? 6;
      tx.insert(planCourses).values({ planId: EXAMPLE_ID, courseCode: code, year, session, units }).run();
    }
    tx.update(plans).set({ readOnly: true }).where(eq(plans.id, EXAMPLE_ID)).run();
  });
}

seedExample();
