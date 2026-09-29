import type { APIRoute } from "astro";
import type { Term } from "../../../lib/check";
import { PlanError, addCourse, moveCourse, removeCourse } from "../../../lib/plans";

// Every change to a plan: add, move or remove a course. The form says which
// with `intent`; `tab` names the browser tab that sent it, so that tab can
// ignore the live-update event its own change causes. Each answer is a 303
// back to the semester that changed, with the refusal in the query if the
// database said no.
const parseTerm = (value: string): Term | undefined => {
  const match = value.match(/^(\d{4})-(S1|S2)$/);
  return match ? { year: Number(match[1]), session: match[2] as Term["session"] } : undefined;
};

export const POST: APIRoute = async ({ params, request, redirect }) => {
  const id = params.id ?? "";
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const code = String(form.get("code") ?? "").toUpperCase().replace(/\s+/g, "");
  const term = parseTerm(String(form.get("term") ?? ""));
  const tab = String(form.get("tab") ?? "") || undefined;
  const anchor = term ? `#t-${term.year}-${term.session}` : "";

  try {
    if (intent === "add" && term) addCourse(id, code, term, tab);
    else if (intent === "move" && term) moveCourse(id, code, term, tab);
    else if (intent === "remove") removeCourse(id, code, tab);
    else throw new PlanError("invalid");
    return redirect(`/plans/${id}${anchor}`, 303);
  } catch (error) {
    if (!(error instanceof PlanError)) throw error;
    const query = new URLSearchParams({ error: error.refusal, code });
    return redirect(`/plans/${id}?${query}${anchor}`, 303);
  }
};
