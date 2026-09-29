import { expect, inject, it } from "vitest";

// A change to a plan goes out on the event stream with the plan's id and the
// tab that made it, which is how every other open page of that plan knows to
// reload. CI also reads this stream after each deploy.
const baseUrl = inject("baseUrl");

it("sends a change to a plan on /api/events", async () => {
  const created = await fetch(new URL("/api/plans", baseUrl), {
    method: "POST",
    headers: { origin: baseUrl },
    body: new URLSearchParams({ name: "Live plan", start: "2026-S1", terms: "6" }),
    redirect: "manual",
  });
  const id = created.headers.get("location")?.split("/plans/")[1] ?? "";

  const stream = await fetch(new URL("/api/events", baseUrl));
  expect(stream.headers.get("content-type")).toContain("text/event-stream");
  const reader = stream.body?.getReader();
  if (!reader) throw new Error("no response body");

  await fetch(new URL(`/api/plans/${id}`, baseUrl), {
    method: "POST",
    headers: { origin: baseUrl },
    body: new URLSearchParams({ intent: "add", code: "COMP1100", term: "2027-S1", tab: "spec-tab" }),
    redirect: "manual",
  });

  const decoder = new TextDecoder();
  let received = "";
  while (!received.includes(id)) {
    const { value, done } = await reader.read();
    if (done) throw new Error("stream ended before the event arrived");
    received += decoder.decode(value, { stream: true });
  }
  await reader.cancel();
  expect(received).toContain("event: plan");
  expect(received).toContain(JSON.stringify({ id, by: "spec-tab" }));
}, 10_000);
