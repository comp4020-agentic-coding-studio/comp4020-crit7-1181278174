import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The catalogue is P&C's words; the rules are read from them by hand. These
// checks hold the rules to the text: a rule may not name a course the text
// doesn't, the text may not name a course the rules ignore, and anything left
// for the student to check is quoted word for word.

type Option = { course?: string; units?: number; subjects?: string[]; levels?: number[]; excluding?: string[] };
type Rule = { groups?: Option[][]; incompatible?: string[]; manual?: string[]; reading?: string };
type Course = {
  code: string;
  units: number;
  requisiteText: string;
  offerings: Record<string, string[]>;
  url: string;
};

const catalogue = JSON.parse(readFileSync("data/catalogue.json", "utf8")) as { courses: Course[] };
const { rules } = JSON.parse(readFileSync("data/requisites.json", "utf8")) as {
  rules: Record<string, Rule>;
};

// Course codes as P&C writes them: "COMP1100", "COMP 1030", and the shorthand
// "COMP1110 /1140". A number ending in 000 is a level ("COMP2000 -level"), not
// a course.
function codesIn(text: string): Set<string> {
  const found = new Set<string>();
  for (const m of text.matchAll(/\b([A-Z]{4}) ?(\d{4})((?:\s*\/\s*\d{4})*)/g)) {
    const [, subject = "", number = "", more = ""] = m;
    for (const n of [number, ...(more.match(/\d{4}/g) ?? [])]) {
      if (!n.endsWith("000")) found.add(subject + n);
    }
  }
  return found;
}

const ruleCodes = (rule: Rule): string[] => [
  ...(rule.groups ?? []).flat().flatMap((option) => [
    ...(option.course ? [option.course] : []),
    ...(option.excluding ?? []),
  ]),
  ...(rule.incompatible ?? []),
];

describe("catalogue", () => {
  it("has a rule entry for every course and no entry for anything else", () => {
    expect(Object.keys(rules).sort()).toEqual(catalogue.courses.map((c) => c.code).sort());
  });

  for (const course of catalogue.courses) {
    const rule = rules[course.code] ?? {};
    const inText = codesIn(course.requisiteText);
    inText.delete(course.code);

    describe(course.code, () => {
      it("names no course its P&C text doesn't", () => {
        for (const code of ruleCodes(rule)) expect(inText, code).toContain(code);
      });

      it("leaves no course in its P&C text unaccounted for", () => {
        const covered = new Set([...ruleCodes(rule), ...(rule.manual ?? []).flatMap((m) => [...codesIn(m)])]);
        for (const code of inText) expect(covered, code).toContain(code);
      });

      it("quotes what it can't check word for word", () => {
        for (const excerpt of rule.manual ?? []) expect(course.requisiteText).toContain(excerpt);
      });

      it("keeps offerings to S1 and S2 of 2026 to 2028", () => {
        expect(Object.keys(course.offerings).sort()).toEqual(["2026", "2027", "2028"]);
        for (const sessions of Object.values(course.offerings)) {
          for (const session of sessions) expect(["S1", "S2"]).toContain(session);
        }
      });

      it("has units and a P&C source", () => {
        expect(course.units).toBeGreaterThan(0);
        expect(course.url).toMatch(/^https:\/\/programsandcourses\.anu\.edu\.au\/20\d\d\/course\//);
      });
    });
  }
});
