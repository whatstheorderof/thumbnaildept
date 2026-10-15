import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { PageHeader, PageBody } from "@/components/app/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Thumbnail, ScorePill } from "@/components/app/thumbnail";
import { Card } from "@/components/ui/card";
import { relativeTime } from "@/lib/utils";
import type { CompositionRow, OrderRow } from "@/lib/types/db";

export const metadata = { title: "Review" };

export default async function ReviewQueue() {
  const { db } = await requireUser();
  const { data } = await db.from("orders").select("*, client:clients(name)").eq("status", "REVIEW").order("deadline", { ascending: true, nullsFirst: false });
  const orders = (data ?? []) as (OrderRow & { client: { name: string } | null })[];
  const { data: comps } = orders.length
    ? await db.from("compositions").select("*, concept:concepts(slot, name)").in("order_id", orders.map((o) => o.id)).neq("critic_verdict", "reject").order("critic_total", { ascending: false })
    : { data: [] };
  const byOrder = new Map<string, (CompositionRow & { concept: { slot: string; name: string } | null })[]>();
  for (const c of (comps ?? []) as (CompositionRow & { concept: { slot: string; name: string } | null })[]) byOrder.set(c.order_id, [...(byOrder.get(c.order_id) ?? []), c]);

  return (
    <>
      <PageHeader title="Review" description="Human approval queue — the strongest three candidates per job. Nothing is delivered without a human approving it." />
      <PageBody className="space-y-5">
        {orders.length === 0 ? <EmptyState title="Queue clear">Jobs appear here when they reach In review.</EmptyState> : orders.map((o) => (
          <Card key={o.id}>
            <Link href={`/orders/${o.job_id}?tab=review`} className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 hover:bg-surface-2">
              <span className="font-mono text-xs text-muted">{o.job_id}</span>
              <span className="text-[13px] font-medium">{o.video_title}</span>
              <span className="text-xs text-muted">{o.client?.name}</span>
              {o.deadline && <span className="ml-auto text-xs text-muted">due {relativeTime(o.deadline)}</span>}
            </Link>
            <div className="grid gap-4 p-4 md:grid-cols-3">
              {(byOrder.get(o.id) ?? []).slice(0, 3).map((c, i) => (
                <div key={c.id}>
                  <Thumbnail src={null} seed={c.id} label={c.concept?.name ?? "Candidate"}>
                    <ScorePill value={c.critic_total} className="absolute left-1.5 top-1.5" />
                    {i === 0 && <span className="absolute right-1.5 top-1.5 rounded bg-white px-1 text-[9px] font-semibold text-black">RECOMMENDED</span>}
                  </Thumbnail>
                  <p className="mt-1.5 line-clamp-2 text-[11px] text-muted">{c.critic_summary}</p>
                </div>
              ))}
              {!byOrder.get(o.id)?.length && <p className="text-xs text-muted">No scored candidates yet.</p>}
            </div>
          </Card>
        ))}
      </PageBody>
    </>
  );
}
