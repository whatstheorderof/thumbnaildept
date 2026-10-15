import Link from "next/link";
import { cn } from "@/lib/utils";

export const ORDER_TABS = [
  ["overview", "Overview"], ["research", "Research"], ["references", "References"], ["creative-dna", "Creative DNA"],
  ["concepts", "Concepts"], ["generations", "Generations"], ["composite", "Composite"], ["review", "Review"],
  ["revision", "Revision"], ["delivery", "Delivery"], ["activity", "Activity"],
] as const;
export type OrderTab = (typeof ORDER_TABS)[number][0];
export const isOrderTab = (t: unknown): t is OrderTab => ORDER_TABS.some(([k]) => k === t);

export function OrderTabs({ jobId, active, counts }: { jobId: string; active: OrderTab; counts: Partial<Record<OrderTab, number>> }) {
  return (
    <nav className="flex gap-0.5 overflow-x-auto border-b border-border px-6 max-md:px-4">
      {ORDER_TABS.map(([key, label]) => (
        <Link key={key} href={`/orders/${jobId}?tab=${key}`} scroll={false}
          className={cn("relative flex h-10 shrink-0 items-center gap-1.5 px-2.5 text-[11px] font-medium uppercase tracking-[0.06em]",
            active === key ? "text-foreground after:absolute after:inset-x-2 after:bottom-[-1px] after:h-px after:bg-foreground" : "text-muted hover:text-foreground")}>
          {label}
          {counts[key] ? <span className="rounded bg-surface-3 px-1 text-[10px] tabular text-muted">{counts[key]}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
