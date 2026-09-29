import type { APIRoute } from "astro";
import { bus, type PlanEvent } from "../../lib/events";

// Server-sent events: every change to any plan goes out as `event: plan`,
// and a plan page reloads when the change is to its plan and came from
// another tab or device. CI reads the opening comment after every deploy,
// so the stream must answer immediately.
export const GET: APIRoute = () => {
  let onPlan: (event: PlanEvent) => void;
  let heartbeat: ReturnType<typeof setInterval>;

  const stream = new ReadableStream<string>({
    start(controller) {
      controller.enqueue(": connected\n\n");
      heartbeat = setInterval(() => controller.enqueue(": ping\n\n"), 30_000);
      onPlan = (event) => {
        controller.enqueue(`event: plan\ndata: ${JSON.stringify(event)}\n\n`);
      };
      bus.on("plan", onPlan);
    },
    cancel() {
      clearInterval(heartbeat);
      bus.off("plan", onPlan);
    },
  });

  return new Response(stream.pipeThrough(new TextEncoderStream()), {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
    },
  });
};
