import { catalogue, leadsTo } from "./catalogue";
import { type CatalogueCourse, type Option, describeUnits } from "./check";

// The course map: what a course needs first, and what it opens. Everything
// here is read from the rules in the catalogue; nothing is added.

export type Need = {
  // "one of" when the group offers several options
  label: string;
  options: {
    code: string | null;
    title: string | null;
    // a units option, in words
    text: string | null;
    inCatalogue: boolean;
    // what the option itself needs, one level further back
    itselfNeeds: string | null;
  }[];
};

export type Opens = { code: string; title: string; alsoNeeds: string | null; hasNote: boolean };

const describeOption = (option: Option): string =>
  option.kind === "units" ? describeUnits(option) : option.code;

// One group in a few words: "COMP2100", "one of COMP1110, COMP1140", or
// "COMP1600 or 6 units of MATH courses".
export function describeGroup(group: Option[]): string {
  if (group.length === 1 && group[0]) return describeOption(group[0]);
  const parts = group.map(describeOption);
  if (group.every((o) => o.kind === "course")) return `one of ${parts.join(", ")}`;
  return parts.join(" or ");
}

export function describeRule(course: CatalogueCourse): string | null {
  if (course.groups.length === 0) return null;
  return course.groups.map(describeGroup).join(" and ");
}

export function needsOf(course: CatalogueCourse): Need[] {
  return course.groups.map((group) => ({
    label: group.length > 1 ? "One of" : group[0]?.kind === "units" ? "Units" : "Required",
    options: group.map((option) => {
      if (option.kind === "units") {
        return { code: null, title: null, text: describeUnits(option), inCatalogue: false, itselfNeeds: null };
      }
      const found = catalogue.courses.get(option.code);
      return {
        code: option.code,
        title: found?.title ?? null,
        text: option.concurrent ? "may be taken in the same semester" : null,
        inCatalogue: Boolean(found),
        itselfNeeds: found ? describeRule(found) : null,
      };
    }),
  }));
}

// Would having `course` alone meet this option?
function metBy(option: Option, course: CatalogueCourse): boolean {
  if (option.kind === "course") return option.code === course.code;
  return (
    course.units >= option.units &&
    (!option.subjects || option.subjects.includes(course.subject)) &&
    (!option.levels || option.levels.includes(course.level)) &&
    !option.excluding.includes(course.code)
  );
}

// The courses whose rules name this one, each with what it still needs once
// this course is done: groups this course alone meets are left out.
export function opensFrom(course: CatalogueCourse): Opens[] {
  return leadsTo(course.code)
    .map((code) => catalogue.courses.get(code))
    .filter((c): c is CatalogueCourse => Boolean(c))
    .map((next) => {
      const rest = next.groups.filter((group) => !group.some((option) => metBy(option, course)));
      return {
        code: next.code,
        title: next.title,
        alsoNeeds: rest.length ? rest.map(describeGroup).join(" and ") : null,
        hasNote: next.manual.length > 0,
      };
    });
}

// When a course runs, in a few words: "every semester, 2026–28", "S2 in 2026,
// 2027, 2028", or the years spelled out.
export function runsText(course: CatalogueCourse): string {
  const years = catalogue.years;
  const all = years.every((y) => (course.offerings[y] ?? []).length === 2);
  if (all) return `every semester, ${years[0]}–${String(years.at(-1)).slice(2)}`;
  const pattern = years.map((y) => `${(course.offerings[y] ?? []).join(" and ") || "none"}`);
  if (new Set(pattern).size === 1) return pattern[0] === "none" ? "not offered 2026–28" : `${pattern[0]} in ${years.join(", ")}`;
  return years.map((y, i) => `${y}: ${pattern[i]}`).join(" · ");
}
