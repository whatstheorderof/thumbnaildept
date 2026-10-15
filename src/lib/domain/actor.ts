import type { ActorType } from "./status";

/** Who is performing an action — a signed-in human, an automation key, or the system itself. */
export interface Actor {
  type: ActorType;
  userId?: string | null;
  label?: string;
}

export const SYSTEM: Actor = { type: "system", label: "system" };
export const automationActor = (label = "automation"): Actor => ({ type: "automation", label });
