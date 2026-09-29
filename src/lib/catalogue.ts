import { notInArray } from "drizzle-orm";
import catalogueFile from "../../data/catalogue.json";
import requisitesFile from "../../data/requisites.json";
import type { Catalogue, CatalogueCourse, Option, Session } from "./check";
import { db } from "./db";
import { courses, incompatibilities, offerings, requisiteOptions } from "./schema";

// The catalogue tables are P&C's words, loaded from data/ at every boot in one
// transaction that never touches plans. The app then reads the catalogue back
// from the database, which is its source of truth while it runs.

type FileOption = {
  course?: string;
  concurrent?: boolean;
  units?: number;
  subjects?: string[];
  levels?: number[];
  excluding?: string[];
};
type FileRule = { groups?: FileOption[][]; incompatible?: string[]; manual?: string[]; reading?: string };

function syncCatalogue(): void {
  const rules = requisitesFile.rules as Record<string, FileRule>;
  db.transaction((tx) => {
    tx.delete(requisiteOptions).run();
    tx.delete(incompatibilities).run();
    tx.delete(offerings).run();
    tx.delete(courses)
      .where(notInArray(courses.code, catalogueFile.courses.map((c) => c.code)))
      .run();

    for (const c of catalogueFile.courses) {
      const rule = rules[c.code] ?? {};
      const row = {
        code: c.code,
        title: c.title,
        units: c.units,
        subject: c.code.slice(0, 4),
        level: Number(c.code[4]) * 1000,
        requisiteText: c.requisiteText,
        rulesYear: c.rulesYear,
        manual: rule.manual ?? [],
        reading: rule.reading ?? null,
        sourceUrl: c.url,
        fetchedAt: catalogueFile.fetchedAt,
      };
      tx.insert(courses).values(row).onConflictDoUpdate({ target: courses.code, set: row }).run();

      for (const [year, sessions] of Object.entries(c.offerings)) {
        for (const session of sessions) {
          tx.insert(offerings).values({ courseCode: c.code, year: Number(year), session: session as Session }).run();
        }
      }
      (rule.groups ?? []).forEach((group, clause) => {
        for (const option of group) {
          tx.insert(requisiteOptions)
            .values(
              option.course
                ? { courseCode: c.code, clause, requiredCode: option.course, concurrent: option.concurrent ?? false }
                : {
                    courseCode: c.code,
                    clause,
                    minUnits: option.units ?? null,
                    subjects: option.subjects ?? null,
                    levels: option.levels ?? null,
                    excluding: option.excluding ?? null,
                  },
            )
            .run();
        }
      });
      for (const other of rule.incompatible ?? []) {
        tx.insert(incompatibilities).values({ courseCode: c.code, otherCode: other }).run();
      }
    }
  });
}

function loadCatalogue(): Catalogue {
  const byCode = new Map<string, CatalogueCourse>();
  for (const row of db.select().from(courses).orderBy(courses.code).all()) {
    byCode.set(row.code, {
      code: row.code,
      title: row.title,
      units: row.units,
      subject: row.subject,
      level: row.level,
      offerings: {},
      groups: [],
      incompatible: [],
      manual: row.manual,
      reading: row.reading,
      requisiteText: row.requisiteText,
      rulesYear: row.rulesYear,
      sourceUrl: row.sourceUrl,
      fetchedAt: row.fetchedAt,
    });
  }

  const years = new Set<number>();
  for (const row of db.select().from(offerings).all()) {
    years.add(row.year);
    const sessions = (byCode.get(row.courseCode)?.offerings ?? {})[row.year];
    if (sessions) sessions.push(row.session);
    else {
      const course = byCode.get(row.courseCode);
      if (course) course.offerings[row.year] = [row.session];
    }
  }
  for (const course of byCode.values()) {
    for (const sessions of Object.values(course.offerings)) sessions.sort();
  }

  const options = db
    .select()
    .from(requisiteOptions)
    .orderBy(requisiteOptions.courseCode, requisiteOptions.clause, requisiteOptions.id)
    .all();
  for (const row of options) {
    const course = byCode.get(row.courseCode);
    if (!course) continue;
    const option: Option = row.requiredCode
      ? { kind: "course", code: row.requiredCode, concurrent: row.concurrent }
      : {
          kind: "units",
          units: row.minUnits ?? 0,
          subjects: row.subjects ?? null,
          levels: row.levels ?? null,
          excluding: row.excluding ?? [],
        };
    (course.groups[row.clause] ??= []).push(option);
  }

  for (const row of db.select().from(incompatibilities).all()) {
    byCode.get(row.courseCode)?.incompatible.push(row.otherCode);
  }

  return { courses: byCode, years: [...years].sort() };
}

syncCatalogue();
export const catalogue: Catalogue = loadCatalogue();
export const catalogueFetchedAt: string = catalogueFile.fetchedAt;

// Courses whose rules name this one: what it leads to.
export function leadsTo(code: string): string[] {
  return [...catalogue.courses.values()]
    .filter((course) => course.groups.flat().some((o) => o.kind === "course" && o.code === code))
    .map((course) => course.code);
}
