import { JSDOM } from "jsdom";
import { describe, expect, inject, it } from "vitest";

// The course map's promises, read from the rendered page: what a course needs
// first, what it opens, and what each opened course still needs once this one
// is done.
const baseUrl = inject("baseUrl");

async function page(path: string): Promise<Document> {
  const res = await fetch(new URL(path, baseUrl));
  return new JSDOM(await res.text()).window.document;
}
const text = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ");

describe("the course map", () => {
  it("shows what COMP2100 needs first", async () => {
    const doc = await page("/map/COMP2100");
    const needs = text(doc.querySelector('[aria-labelledby="need-h"]'));
    expect(needs).toContain("COMP1110");
    expect(needs).toContain("COMP1140");
    expect(needs).toContain("6 units of 1000-level MATH courses");
    // one level further back
    expect(needs).toContain("itself needs one of COMP1100, COMP1130, COMP1730");
  });

  it("lists the ten courses COMP2100 opens, with what each still needs", async () => {
    const doc = await page("/map/COMP2100");
    const opens = [...doc.querySelectorAll('[aria-labelledby="open-h"] .opens a')];
    expect(opens.map((a) => a.getAttribute("href"))).toHaveLength(10);
    const line = (code: string) => text(opens.find((a) => a.textContent?.includes(code)));
    // COMP2100 is itself 6 units of 2000-level COMP, so COMP3310 needs nothing more
    expect(line("COMP3310")).toContain("nothing else");
    expect(line("COMP4712")).toContain("also needs COMP2310");
  });

  it("goes to a course from the form, and answers 404 for one it doesn't know", async () => {
    const res = await fetch(new URL("/map/?code=comp2100", baseUrl), { redirect: "manual" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/map/COMP2100");
    expect((await fetch(new URL("/map/ABCD1234", baseUrl))).status).toBe(404);
  });
});
