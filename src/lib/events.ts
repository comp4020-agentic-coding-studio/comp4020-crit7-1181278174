import { EventEmitter } from "node:events";

// One process, one bus: every open SSE connection subscribes here, and a
// change to a plan is broadcast to all of them as { id, by }, where `by` is
// the browser tab that made the change (so it can ignore its own). This only
// works because the app runs on exactly one machine (see fly.toml).
export type PlanEvent = { id: string; by?: string };

export const bus = new EventEmitter();
bus.setMaxListeners(0);
