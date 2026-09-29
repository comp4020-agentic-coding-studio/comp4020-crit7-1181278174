// Reads the computing majors' requirements from ANU Programs and Courses (P&C)
// into data/majors.json. Run by hand: `node scripts/fetch-majors.ts`.
//
// Which majors: the seven computing majors the Bachelor of Computing lists.
// What it keeps, from each 2027 major page: the title, the requirements
// section as plain text (so tests can hold every block to it), and that
// section split into blocks. A block is a paragraph of P&C's own words ("A
// minimum of 12 units from the following list:") with the course lines that
// follow it: code, title and units as P&C prints them.
//
// It pauses between requests and its User-Agent names only this project.

import { writeFileSync } from "node:fs";

const BASE = "https://programsandcourses.anu.edu.au";
const USER_AGENT = "comp4020-crit7-course-planner (student prototype)";
const PAUSE_MS = 600;
const YEAR = 2027;
const MAJORS = ["COMS-MAJ", "CSEC-MAJ", "DTSC-MAJ", "HCCC-MAJ", "INFS-MAJ", "INSY-MAJ", "SOFT-MAJ"];

type Line = { code: string; title: string; units: string | null };
type Block = { text: string; courses: Line[] };
type Major = { code: string; title: string; url: string; requirementsText: string; blocks: Block[] };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function get(url: string): Promise<string> {
  await sleep(PAUSE_MS);
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT }, redirect: "manual" });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

const plain = (html: string): string =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

async function readMajor(code: string): Promise<Major> {
  const url = `${BASE}/${YEAR}/major/${code}`;
  const page = await get(url);
  const title = plain(page.match(/<h1 class="intro__degree-title">([\s\S]*?)<\/h1>/)?.[1] ?? "");
  const start = page.indexOf('id="requirements"');
  const end = page.indexOf("back-to-top", start);
  if (!title || start < 0 || end < 0) throw new Error(`${code}: no title or requirements section`);
  const section = page.slice(page.indexOf(">", start) + 1, end);

  const blocks: Block[] = [];
  for (const [, inner = ""] of section.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)) {
    const text = plain(inner);
    if (!text) continue;
    const course = inner.match(/\/course\/([A-Z]{4}\d{4})/);
    if (!course?.[1]) {
      blocks.push({ text, courses: [] });
      continue;
    }
    // "COMP3500 Software Engineering Project (6+6 units)"
    const rest = text.replace(course[1], "").trim();
    const units = rest.match(/\(([\d+]+ units)\)\s*$/);
    const line = { code: course[1], title: units ? rest.slice(0, units.index).trim() : rest, units: units?.[1] ?? null };
    const last = blocks.at(-1);
    if (!last) throw new Error(`${code}: a course line before any requirement`);
    last.courses.push(line);
  }
  return { code, title, url, requirementsText: plain(section), blocks };
}

const majors: Major[] = [];
for (const code of MAJORS) {
  majors.push(await readMajor(code));
  process.stdout.write(`${code} `);
}
writeFileSync(
  "data/majors.json",
  `${JSON.stringify({ source: BASE, fetchedAt: new Date().toISOString(), year: YEAR, majors }, null, 2)}\n`,
);
console.log(`\nwrote data/majors.json: ${majors.length} majors`);
