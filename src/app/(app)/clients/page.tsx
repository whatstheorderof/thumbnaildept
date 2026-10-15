import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { PageHeader, PageBody } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { listClients } from "@/lib/services/clients";
import { marketplaceLabel } from "@/lib/domain/categories";
import { relativeTime } from "@/lib/utils";
import { Plus } from "lucide-react";

export const metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const { db } = await requireUser();
  const clients = await listClients(db, q);
  return (
    <>
      <PageHeader title="Clients" description="Returning clients keep their brand, photos and preferences" actions={<Button asChild variant="secondary"><Link href="/clients/new"><Plus />New client</Link></Button>} />
      <PageBody className="space-y-4">
        <form className="max-w-xs"><Input name="q" defaultValue={q} placeholder="Search clients" /></form>
        {clients.length === 0 ? <EmptyState title="No clients">Clients are created here or automatically when an order names one.</EmptyState> : (
          <div className="rounded-lg border border-border bg-surface">
            <Table>
              <THead><TR><TH>Client</TH><TH>Marketplace</TH><TH>Brand</TH><TH className="text-right">Jobs</TH><TH className="text-right">Avg revisions</TH><TH>Last order</TH></TR></THead>
              <TBody>
                {clients.map((c) => (
                  <TR key={c.id} className="hover:bg-surface-2">
                    <TD><Link href={`/clients/${c.id}`} className="font-medium hover:underline">{c.name}</Link>{c.marketplace_username && <div className="text-[11px] text-subtle">@{c.marketplace_username}</div>}</TD>
                    <TD className="text-muted">{marketplaceLabel(c.marketplace)}</TD>
                    <TD><span className="flex gap-1">{c.brand_colours.map((col) => <span key={col} className="size-3.5 rounded-sm border border-border" style={{ background: col }} />)}</span></TD>
                    <TD className="text-right tabular">{c.stats?.job_count ?? 0}</TD>
                    <TD className="text-right tabular text-muted">{Number(c.stats?.avg_revision_count ?? 0).toFixed(1)}</TD>
                    <TD className="text-xs text-muted">{c.stats?.last_order_at ? relativeTime(c.stats.last_order_at) : "—"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </PageBody>
    </>
  );
}
