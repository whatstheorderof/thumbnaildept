import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { PageHeader, PageBody } from "@/components/app/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { MockBadge, Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";
import type { ResearchRunRow } from "@/lib/types/db";

export const metadata = { title: "Research" };

export default async function ResearchPage() {
  const { db } = await requireUser();
  const { data } = await db.from("research_runs").select("*, order:orders(job_id, video_title)").order("created_at", { ascending: false }).limit(100);
  const runs = (data ?? []) as (ResearchRunRow & { order: { job_id: string; video_title: string } | null })[];
  return (
    <>
      <PageHeader title="Research" description="Every research run — per-job research now; Reference Hunts and monthly trend refreshes land here in Phase 7" />
      <PageBody>
        {runs.length === 0 ? <EmptyState title="No research runs">Start research from an order.</EmptyState> : (
          <div className="rounded-lg border border-border bg-surface">
            <Table>
              <THead><TR><TH>When</TH><TH>Job</TH><TH>Topic</TH><TH>Category</TH><TH>Kind</TH><TH className="text-right">Videos</TH><TH>Status</TH></TR></THead>
              <TBody>
                {runs.map((r) => (
                  <TR key={r.id} className="hover:bg-surface-2">
                    <TD className="text-xs text-muted">{formatDateTime(r.created_at)}</TD>
                    <TD className="font-mono text-xs">{r.order ? <Link href={`/orders/${r.order.job_id}?tab=research`} className="hover:underline">{r.order.job_id}</Link> : "—"}</TD>
                    <TD className="max-w-[320px] truncate">{r.topic}</TD>
                    <TD className="text-muted">{r.category ?? "—"}</TD>
                    <TD><Badge>{r.kind}</Badge></TD>
                    <TD className="text-right tabular">{r.video_count}</TD>
                    <TD className="flex items-center gap-1.5"><Badge>{r.status}</Badge><MockBadge mode={r.source} /></TD>
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
