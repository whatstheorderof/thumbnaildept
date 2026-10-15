import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, mono, ...props }: React.HTMLAttributes<HTMLSpanElement> & { mono?: boolean }) {
  return <span className={cn("inline-flex items-center gap-1 rounded border border-border bg-surface-2 px-1.5 py-px text-[11px] text-muted", mono && "font-mono", className)} {...props} />;
}

/** Marks records produced by a development mock or seed rather than a live API. */
export function MockBadge({ mode }: { mode?: string | null }) {
  if (mode !== "mock" && mode !== "seed") return null;
  return <Badge className="border-dashed text-[10px] uppercase tracking-wider">{mode === "mock" ? "Dev mock" : "Seed"}</Badge>;
}
