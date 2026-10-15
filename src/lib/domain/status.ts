/**
 * Order status machine. The single source of truth for which transitions
 * are legal, who may make them, and how each state is displayed.
 */

export const ORDER_STATUSES = [
  "NEW",
  "RESEARCHING",
  "RESEARCH_COMPLETE",
  "CONCEPTING",
  "CONCEPTS_READY",
  "GENERATING",
  "GENERATIONS_READY",
  "REVIEW",
  "REVISION",
  "APPROVED",
  "READY_TO_DELIVER",
  "DELIVERED",
  "CANCELLED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type StatusTone = "neutral" | "research" | "concept" | "generate" | "review" | "revision" | "approved" | "done" | "cancelled";

export const STATUS_META: Record<OrderStatus, { label: string; short: string; tone: StatusTone; description: string }> = {
  NEW:               { label: "New",               short: "New",        tone: "neutral",   description: "Order received, not started." },
  RESEARCHING:       { label: "Researching",       short: "Research",   tone: "research",  description: "Searching YouTube and scoring references." },
  RESEARCH_COMPLETE: { label: "Research complete", short: "Researched", tone: "research",  description: "References scored and selected." },
  CONCEPTING:        { label: "Concepting",        short: "Concept",    tone: "concept",   description: "Building DNA and three concepts." },
  CONCEPTS_READY:    { label: "Concepts ready",    short: "Concepts",   tone: "concept",   description: "Concepts A/B/C ready for generation." },
  GENERATING:        { label: "Generating",        short: "Generate",   tone: "generate",  description: "Leonardo generations in progress." },
  GENERATIONS_READY: { label: "Generations ready", short: "Generated",  tone: "generate",  description: "Candidate imagery ready to composite." },
  REVIEW:            { label: "In review",         short: "Review",     tone: "review",    description: "Awaiting human approval." },
  REVISION:          { label: "Revision",          short: "Revision",   tone: "revision",  description: "Applying client feedback." },
  APPROVED:          { label: "Approved",          short: "Approved",   tone: "approved",  description: "Approved by a human reviewer." },
  READY_TO_DELIVER:  { label: "Ready to deliver",  short: "Ready",      tone: "approved",  description: "Exports and delivery message prepared." },
  DELIVERED:         { label: "Delivered",         short: "Delivered",  tone: "done",      description: "Delivered to the marketplace." },
  CANCELLED:         { label: "Cancelled",         short: "Cancelled",  tone: "cancelled", description: "Order cancelled." },
};

/** The main line shown in the production-state bar (revision/cancel are side states). */
export const PIPELINE: OrderStatus[] = [
  "NEW", "RESEARCHING", "RESEARCH_COMPLETE", "CONCEPTING", "CONCEPTS_READY",
  "GENERATING", "GENERATIONS_READY", "REVIEW", "APPROVED", "READY_TO_DELIVER", "DELIVERED",
];

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW:               ["RESEARCHING", "CANCELLED"],
  RESEARCHING:       ["RESEARCH_COMPLETE", "NEW", "CANCELLED"],
  RESEARCH_COMPLETE: ["CONCEPTING", "RESEARCHING", "CANCELLED"],
  CONCEPTING:        ["CONCEPTS_READY", "RESEARCH_COMPLETE", "CANCELLED"],
  CONCEPTS_READY:    ["GENERATING", "CONCEPTING", "CANCELLED"],
  GENERATING:        ["GENERATIONS_READY", "CONCEPTS_READY", "CANCELLED"],
  GENERATIONS_READY: ["REVIEW", "GENERATING", "CANCELLED"],
  REVIEW:            ["APPROVED", "REVISION", "GENERATING", "CANCELLED"],
  REVISION:          ["GENERATING", "REVIEW", "CANCELLED"],
  APPROVED:          ["READY_TO_DELIVER", "REVISION"],
  READY_TO_DELIVER:  ["DELIVERED", "REVISION"],
  DELIVERED:         ["REVISION"],
  CANCELLED:         ["NEW"],
};

/**
 * States only a signed-in human may move an order into. Automation
 * (Make.com, scripts, webhooks) can never approve a marketplace order.
 */
export const HUMAN_ONLY_TARGETS: OrderStatus[] = ["APPROVED"];

export type ActorType = "user" | "automation" | "system";

export function allowedTransitions(from: OrderStatus, actor: ActorType = "user"): OrderStatus[] {
  return TRANSITIONS[from].filter((to) => actor === "user" || !HUMAN_ONLY_TARGETS.includes(to));
}

export function canTransition(from: OrderStatus, to: OrderStatus, actor: ActorType = "user") {
  return allowedTransitions(from, actor).includes(to);
}

export const ACTIVE_STATUSES: OrderStatus[] = ORDER_STATUSES.filter((s) => s !== "DELIVERED" && s !== "CANCELLED");

export function isOrderStatus(s: unknown): s is OrderStatus {
  return typeof s === "string" && (ORDER_STATUSES as readonly string[]).includes(s);
}

/** Position on the pipeline for progress display (side states map to their nearest step). */
export function pipelineIndex(status: OrderStatus) {
  if (status === "REVISION") return PIPELINE.indexOf("REVIEW");
  if (status === "CANCELLED") return -1;
  return PIPELINE.indexOf(status);
}
