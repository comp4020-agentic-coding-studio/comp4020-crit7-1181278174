import { JSDOM } from "jsdom";
import { describe, expect, inject, it } from "vitest";

// The planner's promises, checked against the running app over HTTP the way a
// browser uses it: a form POST, a 303, a fresh GET. What the page says is the
// contract, so these read the rendered page, not the database.
const baseUrl = inject("baseUrl");

// Astro refuses form POSTs without a same-origin Origin header (CSRF
// protection); browsers send it, a bare fetch has to.
const post = (path: string, fields: Record<string, string>) =>
  fetch(new URL(path, baseUrl), {
    method: "POST",
    headers: { origin: baseUrl },
    body: new URLSearchParams(fields),
    redirect: "manual",
  });

async function newPlan(): Promise<string> {
  const res = await post("/api/plans", { name: "Spec plan", start: "2026-S1", terms: "6" });
  expect(res.status).toBe(303);
  const id = res.headers.get("location")?.match(/^\/plans\/([a-z0-9]+)$/)?.[1];
  if (!id) throw new Error(`no plan id in ${res.headers.get("location")}`);
  return id;
}

const add = (id: string, code: string, term: string) => post(`/api/plans/${id}`, { intent: "add", code, term });

// The text of one semester's card, or of just the courses placed in it (the
// card also lists courses that could be added, which name codes too).
async function semester(id: string, term: string, part = ""): Promise<string> {
  const html = await (await fetch(new URL(`/plans/${id}`, baseUrl))).text();
  const found = new JSDOM(html).window.document.querySelector(`#t-${term} ${part}`.trim());
  return (found?.textContent ?? "").replace(/\s+/g, " ");
}
const placed = (id: string, term: string) => semester(id, term, ".courses");

describe("a plan", () => {
  it("keeps its courses across a reload, and loses one when it's removed", async () => {
    const id = await newPlan();
    const res = await add(id, "COMP1100", "2027-S1");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/plans/${id}#t-2027-S1`);
    expect(await placed(id, "2027-S1")).toContain("COMP1100");

    await post(`/api/plans/${id}`, { intent: "remove", code: "COMP1100", term: "2027-S1" });
    expect(await placed(id, "2027-S1")).not.toContain("COMP1100");
  });

  it("shows a missing prerequisite, and drops it once the prerequisite comes earlier", async () => {
    const id = await newPlan();
    await add(id, "COMP2100", "2027-S1");
    expect(await semester(id, "2027-S1")).toContain("Needs COMP1110 or COMP1140 in an earlier semester.");

    await add(id, "COMP1110", "2026-S2");
    await add(id, "MATH1005", "2026-S1");
    const after = await placed(id, "2027-S1");
    expect(after).not.toContain("Needs");
    // what P&C adds for BSC and ASCAD students is left to the student
    expect(after).toContain("Check the note");
  });

  it("flags a course in a semester it doesn't run in", async () => {
    const id = await newPlan();
    await add(id, "COMP4712", "2027-S1");
    expect(await semester(id, "2027-S1")).toContain("Not offered in 2027 Semester 1.");
  });

  it("flags incompatible courses", async () => {
    const id = await newPlan();
    await add(id, "COMP1100", "2027-S1");
    await add(id, "COMP1130", "2027-S1");
    expect(await semester(id, "2027-S1")).toContain("as incompatible with this course");
  });

  it("flags a semester over 24 units", async () => {
    const id = await newPlan();
    for (const code of ["COMP1100", "COMP1600", "COMP2400", "MATH1005", "MATH1013"]) {
      await add(id, code, "2027-S2");
    }
    expect(await semester(id, "2027-S2")).toContain("30 units: more than the 24");
  });

  it("refuses the same course twice", async () => {
    const id = await newPlan();
    await add(id, "COMP1100", "2027-S1");
    const res = await add(id, "COMP1100", "2027-S2");
    expect(res.headers.get("location")).toContain("error=duplicate");
    expect(await placed(id, "2027-S2")).not.toContain("COMP1100");
  });

  it("refuses a semester outside the plan and a malformed code", async () => {
    const id = await newPlan();
    expect((await add(id, "COMP1100", "2031-S1")).headers.get("location")).toContain("error=outside");
    expect((await add(id, "HELLO", "2027-S1")).headers.get("location")).toContain("error=invalid");
  });
});

describe("the example plan", () => {
  it("refuses changes and keeps its two problems", async () => {
    const res = await post("/api/plans/example", { intent: "remove", code: "COMP4712", term: "2027-S1" });
    expect(res.headers.get("location")).toContain("error=read-only");
    const html = await (await fetch(new URL("/plans/example", baseUrl))).text();
    expect(html).toContain("2 problems to fix");
  });

  it("can be copied into a plan that can be changed", async () => {
    const res = await post("/api/plans", { copy: "example" });
    const copy = res.headers.get("location")?.split("/plans/")[1] ?? "";
    expect(copy).toMatch(/^[a-z0-9]{12}$/);
    await post(`/api/plans/${copy}`, { intent: "remove", code: "COMP4712", term: "2027-S1" });
    expect(await placed(copy, "2027-S1")).not.toContain("COMP4712");
  });
});

it("answers 404 for a plan that doesn't exist", async () => {
  expect((await fetch(new URL("/plans/nothing-here", baseUrl))).status).toBe(404);
});
