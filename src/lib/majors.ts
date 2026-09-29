import { asc } from "drizzle-orm";
import majorsFile from "../../data/majors.json";
import type { PlacedCourse } from "./check";
import { db } from "./db";
import { majorBlocks, majorCourses, majors } from "./schema";

// The computing majors: P&C's requirement paragraphs, loaded at every boot in
// one transaction, then read back from the database. The planner shows them
// and marks which listed courses a plan has; it never decides whether a major
// is complete, because the whole-major rules (unit caps by level) are prose.

export type MajorLine = { code: string; title: string; units: string | null };
export type BlockKind = "compulsory" | "minimum" | "maximum" | "list" | "rule";
export type MajorBlock = { text: string; kind: BlockKind; units: number | null; courses: MajorLine[] };
export type Major = {
  code: string;
  title: string;
  sourceUrl: string;
  fetchedAt: string;
  requirementsText: string;
  // paragraphs before the first course list: the whole-major rules
  rules: string[];
  blocks: MajorBlock[];
  // paragraphs after the course lists: P&C's notes
  notes: string[];
};

function syncMajors(): void {
  db.transaction((tx) => {
    tx.delete(majorCourses).run();
    tx.delete(majorBlocks).run();
    tx.delete(majors).run();
    for (const m of majorsFile.majors) {
      tx.insert(majors)
        .values({
          code: m.code,
          title: m.title,
          requirementsText: m.requirementsText,
          sourceUrl: m.url,
          fetchedAt: majorsFile.fetchedAt,
        })
        .run();
      m.blocks.forEach((block, position) => {
        const { id } = tx
          .insert(majorBlocks)
          .values({ majorCode: m.code, position, text: block.text })
          .returning({ id: majorBlocks.id })
          .get();
        block.courses.forEach((line, i) => {
          tx.insert(majorCourses)
            .values({ blockId: id, position: i, courseCode: line.code, title: line.title, units: line.units })
            .run();
        });
      });
    }
  });
}

// What kind of list a block's own words describe.
export function kindOf(text: string, hasCourses: boolean): BlockKind {
  if (!hasCourses) return "rule";
  if (/compulsory/i.test(text)) return "compulsory";
  if (/^a minimum of/i.test(text)) return "minimum";
  if (/^a maximum of/i.test(text)) return "maximum";
  return "list";
}

function loadMajors(): Major[] {
  const blocks = db.select().from(majorBlocks).orderBy(asc(majorBlocks.majorCode), asc(majorBlocks.position)).all();
  const lines = db.select().from(majorCourses).orderBy(asc(majorCourses.blockId), asc(majorCourses.position)).all();
  return db
    .select()
    .from(majors)
    .orderBy(asc(majors.code))
    .all()
    .map((m) => {
      const own = blocks.filter((b) => b.majorCode === m.code);
      const withCourses = own.map((b) => ({
        text: b.text,
        courses: lines.filter((l) => l.blockId === b.id).map((l) => ({ code: l.courseCode, title: l.title, units: l.units })),
      }));
      const first = withCourses.findIndex((b) => b.courses.length > 0);
      const last = withCourses.findLastIndex((b) => b.courses.length > 0);
      return {
        code: m.code,
        title: m.title,
        sourceUrl: m.sourceUrl,
        fetchedAt: m.fetchedAt,
        requirementsText: m.requirementsText,
        rules: withCourses.slice(0, first).map((b) => b.text),
        blocks: withCourses.slice(first, last + 1).map((b) => ({
          text: b.text,
          kind: kindOf(b.text, b.courses.length > 0),
          units: Number(b.text.match(/(\d+) units/)?.[1]) || null,
          courses: b.courses,
        })),
        notes: withCourses.slice(last + 1).map((b) => b.text),
      };
    });
}

syncMajors();
export const allMajors: Major[] = loadMajors();
export const majorByCode = (code: string): Major | undefined => allMajors.find((m) => m.code === code);

// Which of a block's courses a plan has, and their units. A course counts once
// per block; the page says this is a comparison, not a verdict.
export function compare(block: MajorBlock, plan: PlacedCourse[]): { units: number; placed: Map<string, PlacedCourse> } {
  const placed = new Map<string, PlacedCourse>();
  for (const line of block.courses) {
    const found = plan.find((c) => c.code === line.code);
    if (found) placed.set(line.code, found);
  }
  const units = [...placed.values()].reduce((sum, c) => sum + c.units, 0);
  return { units, placed };
}

// A plan's id from what someone pastes: the id itself or a link to the plan.
export const planIdFrom = (input: string): string =>
  input.trim().match(/plans\/([a-z0-9]+)/)?.[1] ?? input.trim().toLowerCase();
