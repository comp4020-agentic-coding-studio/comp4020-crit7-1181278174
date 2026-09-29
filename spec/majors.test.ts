import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { describe, expect, inject, it } from "vitest";

// The majors are P&C's words. The data checks hold every block and course
// line to the requirements text read from each major's page; the page checks
// read what a student sees, with and without a plan to compare.
const baseUrl = inject("baseUrl");

type Line = { code: string; title: string; units: string | null };
const { majors } = JSON.parse(readFileSync("data/majors.json", "utf8")) as {
  majors: { code: string; title: string; requirementsText: string; blocks: { text: string; courses: Line[] }[] }[];
};

describe("the majors data", () => {
  it("has the seven computing majors", () => {
    expect(majors.map((m) => m.code)).toEqual([
      "COMS-MAJ",
      "CSEC-MAJ",
      "DTSC-MAJ",
      "HCCC-MAJ",
      "INFS-MAJ",
      "INSY-MAJ",
      "SOFT-MAJ",
    ]);
  });

  for (const major of majors) {
    it(`${major.code}: every block and course line is in its P&C text, in order`, () => {
      let from = 0;
      for (const block of major.blocks) {
        const at = major.requirementsText.indexOf(block.text, from);
        expect(at, block.text).toBeGreaterThanOrEqual(0);
        from = at + block.text.length;
        for (const line of block.courses) {
          const code = major.requirementsText.indexOf(line.code, from);
          expect(code, line.code).toBeGreaterThanOrEqual(0);
          expect(major.requirementsText.indexOf(line.title, code), line.title).toBeGreaterThan(code);
          from = code + line.code.length;
        }
      }
      expect(major.blocks.some((b) => b.courses.length > 0)).toBe(true);
    });
  }
});

describe("a major's page", () => {
  const doc = async (path: string) =>
    new JSDOM(await (await fetch(new URL(path, baseUrl))).text()).window.document;

  it("shows each list in P&C's words", async () => {
    const page = await doc("/majors/SOFT-MAJ");
    const headings = [...page.querySelectorAll(".block h2")].map((h) => h.textContent?.trim());
    expect(headings).toEqual([
      "24 units from the completion of the following compulsory courses:",
      "A minimum of 12 units from the following list:",
      "A maximum of 12 units from the following list:",
    ]);
  });

  it("marks what a plan has when compared with one", async () => {
    const page = await doc("/majors/SOFT-MAJ?plan=example");
    const counts = [...page.querySelectorAll(".block .count")].map((c) => c.textContent?.replace(/\s+/g, " ").trim());
    expect(counts[0]).toMatch(/^6 of 24 units in Example/);
    expect(counts[1]).toMatch(/^12 of 12 units in Example/);
    expect(page.body.textContent).toContain("✓ In plan · 2027 S2");
  });

  it("says so when the plan doesn't exist", async () => {
    const page = await doc("/majors/SOFT-MAJ?plan=nothing-here");
    expect(page.body.textContent).toContain("There is no plan at that address.");
  });
});
