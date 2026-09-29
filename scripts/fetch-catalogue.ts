// Reads the planner's catalogue from ANU Programs and Courses (P&C) into
// data/catalogue.json. Run by hand: `node scripts/fetch-catalogue.ts`.
//
// Which courses: every undergraduate COMP course in the 2026 and 2027
// catalogues, plus the courses outside COMP that their prerequisites name.
//
// What it keeps: title, units and requisite text from the 2027 page (the first
// year a plan made now gets checked against), and the S1/S2 offerings for
// 2026-2028 from the class tabs of the 2026 and 2027 pages. The class tab, not
// the search API's Session field, says when a course runs; see
// https://github.com/smcclab/anu-pandc/blob/main/docs/reading-pandc-directly.md
//
// It pauses between requests and its User-Agent names only this project.

import { writeFileSync } from "node:fs";

const BASE = "https://programsandcourses.anu.edu.au";
const USER_AGENT = "comp4020-crit7-course-planner (student prototype)";
const PAUSE_MS = 600;
const RULES_YEAR = 2027;
const OFFERING_YEARS = ["2026", "2027", "2028"];
const OUTSIDE_COMP = [
  "ENGN2219", "ENGN2228", "ENGN3539", "INFS1001",
  "MATH1003", "MATH1005", "MATH1013", "MATH1014", "MATH1113", "MATH1115", "MATH1116",
];

type Session = "S1" | "S2";
const SESSIONS: Record<string, Session> = { "First Semester": "S1", "Second Semester": "S2" };

type Course = {
  code: string;
  title: string;
  units: number;
  requisiteText: string;
  rulesYear: number;
  offerings: Record<string, Session[]>;
  url: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// P&C answers a missing page with a redirect to its error page, not a 404.
async function get(url: string): Promise<string | undefined> {
  await sleep(PAUSE_MS);
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT }, redirect: "manual" });
  if (res.status >= 300 && res.status < 400) return undefined;
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

async function compCodes(year: number): Promise<string[]> {
  const query = new URLSearchParams({
    AppliedFilter: "FilterByCourses",
    SearchText: "COMP",
    SelectedYear: String(year),
    ShowAll: "true",
    PageIndex: "0",
    MaxPageSize: "Infinity",
    PageSize: "Infinity",
    "Careers[0]": "Undergraduate",
  });
  const body = await get(`${BASE}/data/CourseSearch/GetCourses?${query}`);
  if (!body) throw new Error(`no course list for ${year}`);
  const { TotalCount, Items } = JSON.parse(body) as {
    TotalCount: number;
    Items: { CourseCode: string; Career: string }[];
  };
  if (Items.length !== TotalCount) throw new Error(`${year}: got ${Items.length} of ${TotalCount}`);
  // SearchText also matches titles, so filter on the code itself
  return Items.filter((c) => c.CourseCode.startsWith("COMP") && c.Career === "Undergraduate").map(
    (c) => c.CourseCode,
  );
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
    .replace(/\s+([.,;:)])/g, "$1")
    .trim();

function field(html: string, pattern: RegExp, what: string, code: string): string {
  const match = html.match(pattern);
  if (!match?.[1]) throw new Error(`${code}: no ${what} on the page`);
  return match[1];
}

// The class tab holds one block per year, each with an <h3> per teaching period.
function offerings(html: string): Record<string, Session[]> {
  const years = new Map(
    [...html.matchAll(/<a href="#(course-tab-\d+)">(\d{4})<\/a>/g)].map((m) => [m[1], m[2]]),
  );
  const found: Record<string, Session[]> = {};
  const parts = html.split(/<div id="(course-tab-\d+)" class="course-tab-content"/);
  for (let i = 1; i < parts.length; i += 2) {
    const year = years.get(parts[i] ?? "");
    if (!year) continue;
    const block = (parts[i + 1] ?? "").split("<h2")[0] ?? "";
    const sessions = [...block.matchAll(/<h3>([^<]+)<\/h3>/g)]
      .map((m) => SESSIONS[(m[1] ?? "").trim()])
      .filter((s): s is Session => s !== undefined);
    found[year] = [...new Set(sessions)].sort();
  }
  return found;
}

// A course whose unit value is a range (the exchange program, "6 to 24 units")
// is not one you place in a semester; it is left out and reported.
async function readCourse(code: string): Promise<Course | string> {
  const earlier = await get(`${BASE}/2026/course/${code}`);
  const current = await get(`${BASE}/${RULES_YEAR}/course/${code}`);
  const page = current ?? earlier;
  if (!page) throw new Error(`${code}: no page for 2026 or ${RULES_YEAR}`);

  const units = field(page, /Unit Value<\/span>\s*([^<]*?units)/, "unit value", code).trim();
  if (!/^[\d.]+ units$/.test(units)) return `${code} (${units})`;

  const byYear = { ...(earlier ? offerings(earlier) : {}), ...(current ? offerings(current) : {}) };
  const requisite = page.match(/class="requisite">([\s\S]*?)<\/div>/);
  return {
    code,
    title: plain(field(page, /<h1 class="intro__degree-title">([\s\S]*?)<\/h1>/, "title", code)),
    units: Number.parseFloat(units),
    requisiteText: requisite?.[1] ? plain(requisite[1]) : "",
    rulesYear: current ? RULES_YEAR : 2026,
    offerings: Object.fromEntries(OFFERING_YEARS.map((year) => [year, byYear[year] ?? []])),
    url: `${BASE}/${current ? RULES_YEAR : 2026}/course/${code}`,
  };
}

const comp = new Set([...(await compCodes(2026)), ...(await compCodes(RULES_YEAR))]);
const codes = [...comp, ...OUTSIDE_COMP].sort();
const courses: Course[] = [];
const skipped: string[] = [];
for (const code of codes) {
  const course = await readCourse(code);
  if (typeof course === "string") skipped.push(course);
  else courses.push(course);
  process.stdout.write(`${code} `);
}

writeFileSync(
  "data/catalogue.json",
  `${JSON.stringify({ source: BASE, fetchedAt: new Date().toISOString(), rulesYear: RULES_YEAR, courses }, null, 2)}\n`,
);
console.log(`\nwrote data/catalogue.json: ${courses.length} courses; left out: ${skipped.join(", ") || "none"}`);
