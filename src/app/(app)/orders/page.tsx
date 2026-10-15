import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { PageHeader, PageBody } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/app/status";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { listOrders, countByStatus } from "@/lib/services/orders";
import { ORDER_STATUSES, STATUS_META, isOrderStatus, ACTIVE_STATUSES } from "@/lib/domain/status";
import { marketplaceLabel } from "@/lib/domain/categories";
import { cn, formatMoney, relativeTime } from "@/lib/utils";
import { Plus, Search } from "lucide-react";

export const metadata = { title: "Orders" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const sp = await searchParams;
  const { db } = await requireUser();
  const status = sp.status === "active" ? ACTIVE_STATUSES : isOrderStatus(sp.status) ? [sp.status] : undefined;
  const [orders, counts] = await Promise.all([listOrders(db, { status, q: sp.q }), countByStatus(db)]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const chip = (value: string | undefined, label: string, n: number) => {
    const active = (sp.status ?? undefined) === value;
    const href = `/orders?${new URLSearchParams({ ...(value ? { status: value } : {}), ...(sp.q ? { q: sp.q } : {}) })}`;
    return (
      <Link key={label} href={href} className={cn("flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs whitespace-nowrap", active ? "border-border-strong bg-surface-3 text-foreground" : "border-transparent text-muted hover:text-foreground")}>
        {label}<span className="tabular text-subtle">{n}</span>
      </Link>
    );
  };

  return (
    <>
      <PageHeader title="Orders" description="Every thumbnail job, newest first" actions={<Button asChild><Link href="/orders/new"><Plus />NEW THUMBNAIL JOB</Link></Button>} />
      <PageBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <form className="relative w-full max-w-xs" action="/orders">
            {sp.status && <input type="hidden" name="status" value={sp.status} />}
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
            <Input name="q" defaultValue={sp.q} placeholder="Search title, JOB-ID or marketplace ID" className="pl-8" />
          </form>
          <div className="flex flex-wrap gap-1 overflow-x-auto">
            {chip(undefined, "All", total)}
            {chip("active", "Active", ACTIVE_STATUSES.reduce((s, k) => s + counts[k], 0))}
            {ORDER_STATUSES.filter((s) => counts[s] > 0).map((s) => chip(s, STATUS_META[s].label, counts[s]))}
          </div>
        </div>

        {orders.length === 0 ? (
          <EmptyState title={sp.q || sp.status ? "No orders match" : "No orders yet"}>
            {sp.q || sp.status ? "Try clearing the filters." : <>Create one with <Link className="underline" href="/orders/new">New thumbnail job</Link>, or POST to <code>/api/orders</code>.</>}
          </EmptyState>
        ) : (
          <div className="rounded-lg border border-border bg-surface">
            <Table>
              <THead><TR><TH>Job</TH><TH>Video</TH><TH>Client</TH><TH>Category</TH><TH>Status</TH><TH>Deadline</TH><TH className="text-right">Price</TH></TR></THead>
              <TBody>
                {orders.map((o) => {
                  const late = o.deadline && new Date(o.deadline) < new Date() && !["DELIVERED", "CANCELLED"].includes(o.status);
                  return (
                    <TR key={o.id} className="hover:bg-surface-2">
                      <TD className="font-mono text-xs"><Link href={`/orders/${o.job_id}`} className="hover:underline">{o.job_id}</Link></TD>
                      <TD className="max-w-[360px]">
                        <Link href={`/orders/${o.job_id}`} className="block truncate hover:underline">{o.video_title}</Link>
                        <div className="text-[11px] text-subtle">{marketplaceLabel(o.marketplace)}{o.marketplace_order_id ? ` · ${o.marketplace_order_id}` : ""}</div>
                      </TD>
                      <TD className="text-muted">{o.client ? <Link href={`/clients/${o.client.id}`} className="hover:text-foreground">{o.client.name}</Link> : "—"}</TD>
                      <TD className="text-muted">{o.category ?? "—"}</TD>
                      <TD><StatusBadge status={o.status} /></TD>
                      <TD className={cn("text-xs tabular", late ? "text-danger" : "text-muted")}>{o.deadline ? relativeTime(o.deadline) : "—"}</TD>
                      <TD className="text-right tabular text-muted">{formatMoney(o.sale_price, o.currency, 0)}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
        )}
      </PageBody>
    </>
  );
}
