import { describe, expect, it } from "vitest";
import {
  type Catalogue,
  type CatalogueCourse,
  type PlanCheck,
  type Session,
  checkPlan,
} from "../src/lib/check";

// checkPlan on its own, against a small made-up catalogue, so each rule can be
// seen passing and failing in isolation. "Now" is 30 September 2026: semesters
// up to 2026 S2 are done and not checked.

const NOW = new Date("2026-09-30T12:00:00+10:00");

const course = (code: string, extra: Partial<CatalogueCourse> = {}): CatalogueCourse => ({
  code,
  title: `Course ${code}`,
  units: 6,
  subject: code.slice(0, 4),
  level: Number(code[4]) * 1000,
  offerings: { 2026: ["S1", "S2"], 2027: ["S1", "S2"], 2028: ["S1", "S2"] },
  groups: [],
  incompatible: [],
  manual: [],
  reading: null,
  requisiteText: "",
  rulesYear: 2027,
  sourceUrl: `https://programsandcourses.anu.edu.au/2027/course/${code}`,
  fetchedAt: "2026-09-30T00:00:00Z",
  ...extra,
});

const catalogueOf = (...courses: CatalogueCourse[]): Catalogue => ({
  courses: new Map(courses.map((c) => [c.code, c])),
  years: [2026, 2027, 2028],
});

const planOf = (placed: [string, number, Session, number?][], termCount = 6) => ({
  startYear: 2026,
  startSession: "S1" as const,
  termCount,
  courses: placed.map(([code, year, session, units = 6]) => ({ code, year, session, units })),
});

const problems = (result: PlanCheck, code: string) =>
  result.terms.flatMap((t) => t.courses).find((c) => c.code === code)?.problems ?? [];

describe("checkPlan", () => {
  const a = course("COMP1100");
  const b = course("COMP1110", { groups: [[{ kind: "course", code: "COMP1100", concurrent: false }]] });

  it("wants a required course in an earlier semester, not the same one", () => {
    const same = checkPlan(planOf([["COMP1100", 2027, "S1"], ["COMP1110", 2027, "S1"]]), catalogueOf(a, b), NOW);
    expect(problems(same, "COMP1110").map((p) => p.message)).toEqual([
      "Needs COMP1100 in an earlier semester.",
    ]);
    const earlier = checkPlan(planOf([["COMP1100", 2026, "S2"], ["COMP1110", 2027, "S1"]]), catalogueOf(a, b), NOW);
    expect(problems(earlier, "COMP1110")).toEqual([]);
  });

  it("lets a concurrent option sit in the same semester", () => {
    const c = course("COMP2120", { groups: [[{ kind: "course", code: "COMP1100", concurrent: true }]] });
    const result = checkPlan(planOf([["COMP1100", 2027, "S1"], ["COMP2120", 2027, "S1"]]), catalogueOf(a, c), NOW);
    expect(problems(result, "COMP2120")).toEqual([]);
  });

  it("adds up the units a unit rule counts, before the semester only", () => {
    const x = course("COMP3900", {
      groups: [[{ kind: "units", units: 12, subjects: ["COMP"], levels: [2000], excluding: [] }]],
    });
    const cat = catalogueOf(course("COMP2100"), course("COMP2300"), x);
    const enough = checkPlan(
      planOf([["COMP2100", 2026, "S2"], ["COMP2300", 2027, "S1"], ["COMP3900", 2027, "S2"]]),
      cat,
      NOW,
    );
    expect(problems(enough, "COMP3900")).toEqual([]);
    const short = checkPlan(
      planOf([["COMP2100", 2026, "S2"], ["COMP2300", 2027, "S1"], ["COMP3900", 2027, "S1"]]),
      cat,
      NOW,
    );
    expect(problems(short, "COMP3900")[0]?.message).toBe(
      "Needs 12 units of 2000-level COMP courses (the plan has 6 before this semester).",
    );
  });

  it("does not count an excluded course towards a unit rule", () => {
    const y = course("COMP3610", {
      groups: [[{ kind: "units", units: 6, subjects: ["MATH"], levels: null, excluding: ["MATH1003"] }]],
    });
    const cat = catalogueOf(course("MATH1003"), course("MATH1005"), y);
    expect(problems(checkPlan(planOf([["MATH1003", 2026, "S1"], ["COMP3610", 2027, "S1"]]), cat, NOW), "COMP3610")).toHaveLength(1);
    expect(problems(checkPlan(planOf([["MATH1005", 2026, "S1"], ["COMP3610", 2027, "S1"]]), cat, NOW), "COMP3610")).toEqual([]);
  });

  it("flags a semester the course doesn't run in, and notes years not published", () => {
    const z = course("COMP4712", { offerings: { 2026: ["S1"], 2027: [], 2028: ["S2"] } });
    const result = checkPlan(planOf([["COMP4712", 2027, "S1"]]), catalogueOf(z), NOW);
    expect(problems(result, "COMP4712")[0]?.message).toBe(
      "Not offered in 2027 Semester 1. 2027: no offering listed.",
    );
    const later = checkPlan(planOf([["COMP4712", 2029, "S1"]], 8), catalogueOf(z), NOW);
    expect(problems(later, "COMP4712")).toEqual([]);
    expect(later.terms.flatMap((t) => t.courses)[0]?.notes[0]?.kind).toBe("unpublished");
  });

  it("checks nothing in semesters up to the current one", () => {
    const result = checkPlan(planOf([["COMP1110", 2026, "S2"]]), catalogueOf(a, b), NOW);
    expect(problems(result, "COMP1110")).toEqual([]);
    expect(result.terms[1]?.past).toBe(true);
    expect(result.terms[2]?.past).toBe(false);
  });

  it("flags incompatible courses from either side", () => {
    const p = course("COMP1130", { incompatible: ["COMP1100"] });
    const result = checkPlan(planOf([["COMP1100", 2027, "S1"], ["COMP1130", 2027, "S2"]]), catalogueOf(a, p), NOW);
    expect(problems(result, "COMP1130")[0]?.kind).toBe("incompatible");
    expect(problems(result, "COMP1100")[0]?.kind).toBe("incompatible");
  });

  it("flags more than 24 units in a semester", () => {
    const codes = ["COMP1100", "COMP1110", "COMP1600", "COMP2100", "COMP2300"];
    const cat = catalogueOf(...codes.map((code) => course(code)));
    const result = checkPlan(planOf(codes.map((code) => [code, 2027, "S2"] as [string, number, Session])), cat, NOW);
    expect(result.terms[3]?.units).toBe(30);
    expect(result.terms[3]?.overload?.kind).toBe("load");
    expect(result.problemCount).toBe(1);
  });

  it("lists the courses that could be taken: offered then, rules met, not in the plan", () => {
    const s2only = course("COMP1140", { offerings: { 2026: ["S2"], 2027: ["S2"], 2028: ["S2"] } });
    const result = checkPlan(planOf([["COMP1100", 2027, "S1"]]), catalogueOf(a, b, s2only), NOW);
    expect(result.terms[2]?.eligible).toEqual([]); // 2027 S1: COMP1110 needs COMP1100 earlier
    expect(result.terms[3]?.eligible).toEqual(["COMP1110", "COMP1140"]);
  });

  it("counts a course outside the catalogue but does not check it", () => {
    const result = checkPlan(planOf([["ECON1101", 2027, "S1", 6]]), catalogueOf(a), NOW);
    expect(result.terms[2]?.units).toBe(6);
    expect(result.terms[2]?.courses[0]?.notes[0]?.kind).toBe("unchecked");
    expect(result.problemCount).toBe(0);
  });
});
