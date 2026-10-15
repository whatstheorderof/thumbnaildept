import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { PageHeader, PageBody } from "@/components/app/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge, StatusDot } from "@/components/app/status";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { ACTIVE_STATUSES, PIPELINE, STATUS_META, type OrderStatus } from "@/lib/domain/status";
import { countByStatus, listOrders } from "@/lib/services/orders";
import { formatMoney, relativeTime, cn } from "@/lib/utils";
import { getSettings } from "@/lib/services/settings";
import type { ActivityRow } from "@/lib/types/db";
import { Plus } from "lucide-react";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const { db } = await requireUser();
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const [counts, active, settings, { data: monthOrders }, { data: costs }, { data: activity }] = await Promise.all([
    countByStatus(db),
    listOrders(db, { status: ACTIVE_STATUSES, limit: 100 }),
    getSettings(db),
    db.from("orders").select("id, sale_price, marketplace_fee, status").gte("created_at", monthStart.toISOString()).neq("status", "CANCELLED"),
    db.from("cost_entries").select("cost, currency").gte("created_at", monthStart.toISOString()),
    db.from("activity_log").select("*, order:orders(job_id)").order("created_at", { ascending: false }).limit(12),
  ]);

  const revenue = (monthOrders ?? []).reduce((s, o) => s + Number(o.sale_price), 0);
  const fees = (monthOrders ?? []).reduce((s, o) => s + Number(o.marketplace_fee ?? 0), 0);
  const aiCost = (costs ?? []).reduce((s, c) => s + (c.currency === "USD" ? Number(c.cost) * settings.pricing.usdToGbp : Number(c.cost)), 0);
  const dueSoon = active.filter((o) => o.deadline).sort((a, b) => +new Date(a.deadline!) - +new Date(b.deadline!)).slice(0, 6);
  const activeCount = ACTIVE_STATUSES.reduce((s, k) => s + counts[k], 0);
  const overdue = active.filter((o) => o.deadline && new Date(o.deadline) < new Date()).length;

  return (
    <>
      <PageHeader title="Dashboard" description="Production overview" actions={
        <Button asChild><Link href="/orders/new"><Plus />NEW THUMBNAIL JOB</Link></Button>
      } />
      <PageBody className="space-y-5">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-5">
          <Stat label="Active jobs" value={activeCount} />
          <Stat label="Awaiting review" value={counts.REVIEW} href="/review" />
          <Stat label="Overdue" value={overdue} danger={overdue > 0} />
          <Stat label="Revenue (month)" value={formatMoney(revenue, settings.pricing.currency, 0)} />
          <Stat label="Contribution (month)" value={formatMoney(revenue - fees - aiCost, settings.pricing.currency, 0)} sub={`AI cost ${formatMoney(aiCost, settings.pricing.currency)}`} />
        </div>

        <Card>
          <CardHeader title="Pipeline" description="Jobs at each production stage" />
          <div className="grid grid-cols-3 gap-px bg-border sm:grid-cols-6 xl:grid-cols-12">
            {[...PIPELINE, "REVISION" as OrderStatus].map((s) => (
              <Link key={s} href={`/orders?status=${s}`} className="bg-surface px-3 py-3 hover:bg-surface-2">
                <div className="flex items-center gap-1.5"><StatusDot status={s} /><span className="truncate text-[11px] text-muted">{STATUS_META[s].short}</span></div>
                <div className={cn("mt-1 text-lg font-semibold tabular", counts[s] === 0 && "text-subtle")}>{counts[s]}</div>
              </Link>
            ))}
          </div>
        </Card>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader title="Due next" action={<Link href="/orders" className="text-xs text-muted hover:text-foreground">All orders →</Link>} />
            {dueSoon.length === 0 ? <div className="p-4"><EmptyState title="Nothing due">Active jobs with deadlines appear here.</EmptyState></div> : (
              <ul>
                {dueSoon.map((o) => {
                  const late = new Date(o.deadline!) < new Date();
                  return (
                    <li key={o.id} className="border-b border-border last:border-0">
                      <Link href={`/orders/${o.job_id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                        <span className="w-[86px] shrink-0 font-mono text-[11px] text-muted">{o.job_id}</span>
                        <span className="min-w-0 flex-1 truncate text-[13px]">{o.video_title}</span>
                        <StatusBadge status={o.status} className="max-sm:hidden" />
                        <span className={cn("w-24 shrink-0 text-right text-xs tabular", late ? "text-danger" : "text-muted")}>{relativeTime(o.deadline)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Activity" />
            {(activity ?? []).length === 0 ? <div className="p-4"><EmptyState title="No activity yet" /></div> : (
              <ul className="divide-y divide-border">
                {(activity as (ActivityRow & { order: { job_id: string } | null })[]).map((a) => (
                  <li key={a.id} className="flex gap-3 px-4 py-2 text-xs">
                    {a.order ? <Link href={`/orders/${a.order.job_id}?tab=activity`} className="w-[78px] shrink-0 font-mono text-[11px] text-muted hover:text-foreground">{a.order.job_id}</Link> : <span className="w-[78px] shrink-0 text-subtle">—</span>}
                    <span className="min-w-0 flex-1 truncate">{a.message}</span>
                    <span className="shrink-0 text-subtle">{relativeTime(a.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </PageBody>
    </>
  );
}

function Stat({ label, value, sub, href, danger }: { label: string; value: React.ReactNode; sub?: string; href?: string; danger?: boolean }) {
  const inner = (
    <div className="h-full bg-surface px-4 py-3.5">
      <div className="label-caps">{label}</div>
      <div className={cn("mt-1.5 text-2xl font-semibold tracking-tight tabular", danger && "text-danger")}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-subtle">{sub}</div>}
    </div>
  );
  return href ? <Link href={href} className="block bg-surface hover:opacity-90">{inner}</Link> : inner;
}
