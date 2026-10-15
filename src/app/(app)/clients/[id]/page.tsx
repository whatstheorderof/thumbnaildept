import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { PageHeader, PageBody } from "@/components/app/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActionForm } from "@/components/app/action-form";
import { Uploader } from "@/components/app/uploader";
import { Thumbnail } from "@/components/app/thumbnail";
import { StatusBadge } from "@/components/app/status";
import { DeleteAssetButton } from "@/components/order/delete-asset-button";
import { getClientRecord } from "@/lib/services/clients";
import { listOrders } from "@/lib/services/orders";
import { BUCKETS, signedUrls } from "@/lib/services/uploads";
import { ServiceError } from "@/lib/services/errors";
import { ClientFields } from "../client-form";
import { updateClientAction } from "../actions";
import { formatDate, isUuid } from "@/lib/utils";
import type { OrderAssetRow } from "@/lib/types/db";
import { Plus } from "lucide-react";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { db } = await requireUser();
  let rec;
  try { rec = await getClientRecord(db, id); } catch (e) { if (e instanceof ServiceError) notFound(); throw e; }
  const { client, stats } = rec;
  const [orders, { data: assetRows }] = await Promise.all([
    listOrders(db, { clientId: id }),
    db.from("order_assets").select("*").eq("client_id", id).order("created_at", { ascending: false }),
  ]);
  const assets = (assetRows ?? []) as OrderAssetRow[];
  const urls = await signedUrls(db, BUCKETS.orderAssets, assets.map((a) => a.storage_path));
  const faces = assets.filter((a) => a.kind === "face_photo");
  const other = assets.filter((a) => a.kind !== "face_photo");

  return (
    <>
      <PageHeader eyebrow="Clients" title={client.name} description={`${stats?.job_count ?? 0} jobs · ${Number(stats?.avg_revision_count ?? 0).toFixed(1)} avg revisions`}
        actions={<Button asChild><Link href={`/orders/new?client=${client.id}`}><Plus />New job for {client.name}</Link></Button>} />
      <PageBody className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Approved face photographs" description="Real photos are composited as-is rather than regenerated" />
            <CardBody className="space-y-3">
              {faces.length > 0 && <AssetGrid assets={faces} urls={urls} />}
              <Uploader target={{ scope: "client_asset", clientId: client.id, kind: "face_photo" }} label="Upload approved face photos" compact />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Saved assets" description="Logos, brand files and assets from previous jobs" />
            <CardBody className="space-y-3">
              {other.length > 0 && <AssetGrid assets={other} urls={urls} />}
              <div className="grid gap-2 sm:grid-cols-2">
                <Uploader target={{ scope: "client_asset", clientId: client.id, kind: "logo" }} label="Upload logos" compact />
                <Uploader target={{ scope: "client_asset", clientId: client.id, kind: "brand" }} label="Upload brand files" accept="image/*,.ttf,.otf,.woff,.woff2,.zip,.pdf" compact />
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Previous jobs" />
            {orders.length === 0 ? <CardBody><p className="text-xs text-muted">No jobs yet.</p></CardBody> : (
              <ul className="divide-y divide-border">
                {orders.map((o) => (
                  <li key={o.id}><Link href={`/orders/${o.job_id}`} className="flex items-center gap-3 px-4 py-2.5 text-[13px] hover:bg-surface-2">
                    <span className="font-mono text-[11px] text-muted">{o.job_id}</span><span className="min-w-0 flex-1 truncate">{o.video_title}</span>
                    <StatusBadge status={o.status} /><span className="text-xs text-subtle">{formatDate(o.created_at)}</span>
                  </Link></li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <Card className="self-start">
          <CardHeader title="Profile" />
          <CardBody><ActionForm action={updateClientAction.bind(null, client.id)}><ClientFields client={client} /></ActionForm></CardBody>
        </Card>
      </PageBody>
    </>
  );
}

function AssetGrid({ assets, urls }: { assets: OrderAssetRow[]; urls: Record<string, string> }) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
      {assets.map((a) => (
        <div key={a.id}>
          <Thumbnail src={a.mime_type?.startsWith("image/") ? urls[a.storage_path] : null} seed={a.id} label={a.file_name} size="sm" className="aspect-square" />
          <div className="mt-1 flex items-center gap-1">
            {a.order_id ? <Badge>job</Badge> : <Badge>profile</Badge>}
            <span className="min-w-0 flex-1 truncate text-[10px] text-muted">{a.file_name}</span>
            <DeleteAssetButton assetId={a.id} />
          </div>
        </div>
      ))}
    </div>
  );
}
