import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { PageHeader, PageBody } from "@/components/app/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { MockBadge, Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";
import type { GenerationRow } from "@/lib/types/db";

export const metadata = { title: "Generate" };

export default async function GeneratePage() {
  const { db } = await requireUser();
  const { data } = await db.from("generations").select("*, order:orders(job_id), concept:concepts(slot, name)").order("created_at", { ascending: false }).limit(200);
  const gens = (data ?? []) as (GenerationRow & { order: { job_id: string } | null; concept: { slot: string; name: string } | null })[];
  const pending = gens.filter((g) => g.status === "queued" || g.status === "pending").length;
  return (
    <>
      <PageHeader title="Generate" description={`Leonardo generation queue · ${pending} in flight`} />
      <PageBody>
        {gens.length === 0 ? <EmptyState phase={4} title="Queue is empty">Generations are created from concepts and completed by the Leonardo webhook.</EmptyState> : (
          <div className="rounded-lg border border-border bg-surface">
            <Table>
              <THead><TR><TH>Requested</TH><TH>Job</TH><TH>Concept</TH><TH>Model</TH><TH className="text-right">Images</TH><TH className="text-right">Cost</TH><TH>Status</TH></TR></THead>
              <TBody>
                {gens.map((g) => (
                  <TR key={g.id}>
                    <TD className="text-xs text-muted">{formatDateTime(g.requested_at ?? g.created_at)}</TD>
                    <TD className="font-mono text-xs">{g.order && <Link href={`/orders/${g.order.job_id}?tab=generations`} className="hover:underline">{g.order.job_id}</Link>}</TD>
                    <TD className="max-w-[280px] truncate">{g.concept ? `${g.concept.slot} · ${g.concept.name}` : "—"}</TD>
                    <TD className="font-mono text-xs text-muted">{g.model}</TD>
                    <TD className="text-right tabular">{g.num_images}</TD>
                    <TD className="text-right text-xs tabular">{g.cost != null ? `$${Number(g.cost).toFixed(3)}` : "—"}</TD>
                    <TD className="flex items-center gap-1.5"><Badge>{g.status}</Badge><MockBadge mode={g.source_mode} /></TD>
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
