import type { APIRoute } from "astro";
import { PlanError, copyPlan, createPlan } from "../../../lib/plans";

// Start a plan, or copy one (the example is read-only, so copying is how you
// build on it). A plain form POSTs here and is sent on to the new plan: 303
// and a GET, so the form works with no JavaScript.
export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  try {
    const copy = String(form.get("copy") ?? "");
    if (copy) return redirect(`/plans/${copyPlan(copy)}`, 303);

    const [year, session] = String(form.get("start") ?? "").split("-");
    const input = {
      name: String(form.get("name") ?? "").trim().slice(0, 80),
      startYear: Number(year),
      startSession: session === "S2" ? ("S2" as const) : ("S1" as const),
      termCount: Number(form.get("terms")),
    };
    if (!input.name || !Number.isInteger(input.startYear) || !Number.isInteger(input.termCount)) {
      return redirect("/?error=invalid#start", 303);
    }
    return redirect(`/plans/${createPlan(input)}`, 303);
  } catch (error) {
    if (error instanceof PlanError) return redirect("/?error=invalid#start", 303);
    throw error;
  }
};
