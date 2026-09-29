// checkPlan decides every status the app shows. It is a pure function of a
// plan, the catalogue and the date, so the pages only display what it returns
// and the tests can call it directly.

export type Session = "S1" | "S2";
export type Term = { year: number; session: Session };

export type Option =
  | { kind: "course"; code: string; concurrent: boolean }
  | {
      kind: "units";
      units: number;
      subjects: string[] | null;
      levels: number[] | null;
      excluding: string[];
    };

export type CatalogueCourse = {
  code: string;
  title: string;
  units: number;
  subject: string;
  level: number;
  offerings: Record<number, Session[]>;
  groups: Option[][];
  incompatible: string[];
  manual: string[];
  reading: string | null;
  requisiteText: string;
  rulesYear: number;
  sourceUrl: string;
  fetchedAt: string;
};

export type Catalogue = {
  courses: Map<string, CatalogueCourse>;
  // the years P&C publishes offerings for
  years: number[];
};

export type PlacedCourse = { code: string; year: number; session: Session; units: number };
export type PlanShape = {
  startYear: number;
  startSession: Session;
  termCount: number;
  courses: PlacedCourse[];
};

export type Problem = {
  kind: "prerequisite" | "offering" | "incompatible" | "load";
  message: string;
  source: string;
  hint?: string;
  // a course that would meet the rule, and a semester of this plan it fits
  fix?: { code: string; term: Term };
};
export type Note = { kind: "manual" | "unpublished" | "unchecked"; message: string };

export type CourseCheck = {
  code: string;
  title: string | null;
  units: number;
  term: Term;
  problems: Problem[];
  notes: Note[];
};

export type TermCheck = {
  term: Term;
  // up to and including the semester running now: done, not checked
  past: boolean;
  // P&C publishes offerings for this year
  published: boolean;
  // a future year: P&C calls its offerings indicative
  indicative: boolean;
  units: number;
  overload: Problem | null;
  courses: CourseCheck[];
  eligible: string[];
};

export type PlanCheck = { terms: TermCheck[]; problemCount: number; totalUnits: number };

export const LOAD_LIMIT = 24;
export const OVERLOAD_SOURCE =
  "https://www.anu.edu.au/students/program-administration/enrolment/overload-your-enrolment";

export const termIndex = (t: Term): number => t.year * 2 + (t.session === "S2" ? 1 : 0);
export const termAt = (index: number): Term => ({
  year: Math.floor(index / 2),
  session: index % 2 === 1 ? "S2" : "S1",
});
export const termLabel = (t: Term): string =>
  `${t.year} Semester ${t.session === "S1" ? "1" : "2"}`;
export const shortLabel = (t: Term): string => `${t.year} ${t.session}`;

// ANU's first semester runs February to June, the second July to November.
export const currentTerm = (now: Date): Term => ({
  year: now.getFullYear(),
  session: now.getMonth() < 6 ? "S1" : "S2",
});

export function planTerms(plan: Pick<PlanShape, "startYear" | "startSession" | "termCount">): Term[] {
  const start = termIndex({ year: plan.startYear, session: plan.startSession });
  return Array.from({ length: plan.termCount }, (_, i) => termAt(start + i));
}

const subjectOf = (code: string): string => code.slice(0, 4);
const levelOf = (code: string): number => Number(code[4]) * 1000;

function join(items: string[], word: "or" | "and"): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${word} ${items.at(-1)}`;
}

export function describeUnits(option: Extract<Option, { kind: "units" }>): string {
  const level = option.levels ? `${join(option.levels.map(String), "or")}-level ` : "";
  const subjects = option.subjects ? `${join(option.subjects, "or")} ` : "";
  const excluding = option.excluding.length ? ` (not counting ${join(option.excluding, "or")})` : "";
  return `${option.units} units of ${level}${subjects}courses${excluding}`;
}

// Units the plan has, strictly before `before`, that an option counts.
function unitsFor(option: Extract<Option, { kind: "units" }>, plan: PlacedCourse[], before: number): number {
  return plan
    .filter((c) => termIndex(c) < before)
    .filter((c) => !option.subjects || option.subjects.includes(subjectOf(c.code)))
    .filter((c) => !option.levels || option.levels.includes(levelOf(c.code)))
    .filter((c) => !option.excluding.includes(c.code))
    .reduce((sum, c) => sum + c.units, 0);
}

function met(option: Option, plan: PlacedCourse[], at: number): boolean {
  if (option.kind === "units") return unitsFor(option, plan, at) >= option.units;
  const placed = plan.find((c) => c.code === option.code);
  if (!placed) return false;
  return option.concurrent ? termIndex(placed) <= at : termIndex(placed) < at;
}

function describeGroup(group: Option[], plan: PlacedCourse[], at: number): string {
  const courses = group.flatMap((o) => (o.kind === "course" ? [o] : []));
  const units = group.flatMap((o) => (o.kind === "units" ? [o] : []));
  const when = courses.length > 0 && courses.every((o) => o.concurrent)
    ? "in this or an earlier semester"
    : "in an earlier semester";
  if (units.length === 0) return `Needs ${join(courses.map((o) => o.code), "or")} ${when}.`;
  const parts = [
    ...courses.map((o) => o.code),
    ...units.map((o) => `${describeUnits(o)} (the plan has ${unitsFor(o, plan, at)} before this semester)`),
  ];
  return courses.length === 0
    ? `Needs ${parts.join(", or ")}.`
    : `Needs ${parts.join(", or ")}, ${when}.`;
}

// For an unmet group: the first required course that runs in a semester of
// this plan where it would count.
function hintFor(
  group: Option[],
  catalogue: Catalogue,
  terms: TermCheck[],
  at: number,
): { hint: string; fix: { code: string; term: Term } } | undefined {
  for (const option of group) {
    if (option.kind !== "course") continue;
    const course = catalogue.courses.get(option.code);
    if (!course) continue;
    const fits = terms.filter(
      (t) =>
        !t.past &&
        (option.concurrent ? termIndex(t.term) <= at : termIndex(t.term) < at) &&
        course.offerings[t.term.year]?.includes(t.term.session),
    );
    const latest = fits.at(-1);
    if (latest) {
      return {
        hint: `${option.code} runs in ${termLabel(latest.term)}, which is in this plan.`,
        fix: { code: option.code, term: latest.term },
      };
    }
  }
  return undefined;
}

function incompatibleWith(course: CatalogueCourse, code: string, catalogue: Catalogue): boolean {
  return (
    course.incompatible.includes(code) ||
    (catalogue.courses.get(code)?.incompatible.includes(course.code) ?? false)
  );
}

export function checkPlan(plan: PlanShape, catalogue: Catalogue, now: Date): PlanCheck {
  const current = termIndex(currentTerm(now));
  const terms: TermCheck[] = planTerms(plan).map((term) => ({
    term,
    past: termIndex(term) <= current,
    published: catalogue.years.includes(term.year),
    indicative: term.year > currentTerm(now).year,
    units: 0,
    overload: null,
    courses: [],
    eligible: [],
  }));

  for (const t of terms) {
    const at = termIndex(t.term);
    const here = plan.courses.filter((c) => termIndex(c) === at).sort((a, b) => a.code.localeCompare(b.code));
    t.units = here.reduce((sum, c) => sum + c.units, 0);
    if (!t.past && t.units > LOAD_LIMIT) {
      t.overload = {
        kind: "load",
        message: `${t.units} units: more than the ${LOAD_LIMIT} a semester you can enrol in without an approved overload.`,
        source: OVERLOAD_SOURCE,
      };
    }

    for (const placed of here) {
      const course = catalogue.courses.get(placed.code);
      const check: CourseCheck = {
        code: placed.code,
        title: course?.title ?? null,
        units: placed.units,
        term: t.term,
        problems: [],
        notes: [],
      };
      t.courses.push(check);
      if (!course) {
        check.notes.push({ kind: "unchecked", message: "Not in this planner's catalogue, so nothing about it is checked." });
        continue;
      }
      if (t.past) continue;

      if (!t.published) {
        check.notes.push({ kind: "unpublished", message: `P&C has not published offerings for ${t.term.year}.` });
      } else if (!course.offerings[t.term.year]?.includes(t.term.session)) {
        const runs = course.offerings[t.term.year] ?? [];
        check.problems.push({
          kind: "offering",
          message: `Not offered in ${termLabel(t.term)}. ${t.term.year}: ${
            runs.length ? join(runs.map((s) => (s === "S1" ? "Semester 1" : "Semester 2")), "and") : "no offering listed"
          }.`,
          source: course.sourceUrl,
        });
      }

      for (const group of course.groups) {
        if (group.some((option) => met(option, plan.courses, at))) continue;
        check.problems.push({
          kind: "prerequisite",
          message: describeGroup(group, plan.courses, at),
          source: course.sourceUrl,
          ...hintFor(group, catalogue, terms, at),
        });
      }

      for (const other of plan.courses) {
        if (other.code !== course.code && incompatibleWith(course, other.code, catalogue)) {
          check.problems.push({
            kind: "incompatible",
            message: `P&C lists ${other.code} (${shortLabel(other)}) as incompatible with this course.`,
            source: course.sourceUrl,
          });
        }
      }

      for (const excerpt of course.manual) {
        check.notes.push({ kind: "manual", message: excerpt });
      }
    }

    if (!t.past && t.published) {
      const inPlan = new Set(plan.courses.map((c) => c.code));
      t.eligible = [...catalogue.courses.values()]
        .filter((course) => !inPlan.has(course.code))
        .filter((course) => course.offerings[t.term.year]?.includes(t.term.session))
        .filter((course) => course.groups.every((group) => group.some((o) => met(o, plan.courses, at))))
        .filter((course) => ![...inPlan].some((code) => incompatibleWith(course, code, catalogue)))
        .map((course) => course.code)
        .sort();
    }
  }

  const problemCount = terms.reduce(
    (sum, t) => sum + (t.overload ? 1 : 0) + t.courses.reduce((n, c) => n + c.problems.length, 0),
    0,
  );
  const totalUnits = terms.reduce((sum, t) => sum + t.units, 0);
  return { terms, problemCount, totalUnits };
}

// What a change did to the plan's problems, in a sentence or two.
export function describeChange(action: string, before: PlanCheck, after: PlanCheck): string {
  const problemsByCourse = (check: PlanCheck) =>
    new Map(check.terms.flatMap((t) => t.courses.map((c) => [c.code, c.problems.length] as const)));
  const was = problemsByCourse(before);
  const now = problemsByCourse(after);
  const broke = [...now].filter(([code, n]) => n > 0 && (was.get(code) ?? 0) === 0).map(([code]) => code);
  const fixed = [...was].filter(([code, n]) => n > 0 && now.get(code) === 0).map(([code]) => code);
  const parts = [action];
  if (broke.length) parts.push(`Now has a problem: ${join(broke, "and")}.`);
  if (fixed.length) parts.push(`No longer has a problem: ${join(fixed, "and")}.`);
  return parts.join(" ");
}
