import { z } from "zod";
import type { DB, AssetKind } from "@/lib/types/db";
import type { Actor } from "@/lib/domain/actor";
import { logActivity } from "./activity";
import { ServiceError } from "./errors";

/**
 * Uploads go browser → Supabase Storage directly via one-time signed upload
 * URLs (keeps large photos off the Vercel function body limit). The server
 * decides the path, so every file stays scoped to its job or client.
 */
export const BUCKETS = { orderAssets: "order-assets", research: "research", generations: "generations", deliverables: "deliverables" } as const;

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const ALLOWED = /^(image\/(png|jpe?g|webp|gif|avif|heic|heif|svg\+xml)|font\/.+|application\/(x-font-.+|font-.+|zip|pdf|octet-stream))$/i;

export const uploadTargetSchema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("order_asset"), orderId: z.string().uuid(), kind: z.enum(["client_asset", "face_photo", "logo", "font", "brand", "other"]).default("client_asset") }),
  z.object({ scope: z.literal("order_reference"), orderId: z.string().uuid() }),
  z.object({ scope: z.literal("client_asset"), clientId: z.string().uuid(), kind: z.enum(["client_asset", "face_photo", "logo", "font", "brand", "other"]).default("client_asset") }),
]);
export type UploadTarget = z.infer<typeof uploadTargetSchema>;

export const fileMetaSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.string().max(100).default("application/octet-stream"),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES, "File is larger than 50 MB"),
});

const safeName = (name: string) => name.normalize("NFKD").replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").slice(-120);

function prefixFor(t: UploadTarget) {
  switch (t.scope) {
    case "order_asset": return `orders/${t.orderId}/assets/`;
    case "order_reference": return `orders/${t.orderId}/references/`;
    case "client_asset": return `clients/${t.clientId}/assets/`;
  }
}

export async function createSignedUploads(db: DB, target: UploadTarget, files: z.input<typeof fileMetaSchema>[]) {
  const metas = files.map((f) => fileMetaSchema.parse(f));
  for (const m of metas) if (!ALLOWED.test(m.type) && !/\.(ttf|otf|woff2?)$/i.test(m.name)) {
    throw new ServiceError(`${m.name}: unsupported file type ${m.type}`);
  }
  const prefix = prefixFor(target);
  return Promise.all(metas.map(async (m) => {
    const path = `${prefix}${crypto.randomUUID()}-${safeName(m.name)}`;
    const { data, error } = await db.storage.from(BUCKETS.orderAssets).createSignedUploadUrl(path);
    if (error || !data) throw new ServiceError(`Could not create upload URL: ${error?.message}`, 500);
    return { bucket: BUCKETS.orderAssets, path: data.path, token: data.token, name: m.name, type: m.type, size: m.size };
  }));
}

export const recordUploadSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1).max(255),
  type: z.string().max(100).optional(),
  size: z.number().int().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  note: z.string().max(500).optional(),
});

/** Record an uploaded file once the browser has finished uploading it. */
export async function recordUploads(db: DB, target: UploadTarget, uploads: z.input<typeof recordUploadSchema>[], actor: Actor) {
  const items = uploads.map((u) => recordUploadSchema.parse(u));
  const prefix = prefixFor(target);
  for (const u of items) if (!u.path.startsWith(prefix)) throw new ServiceError("Upload path does not belong to this job/client", 403, "forbidden");

  // Verify the object really exists before recording it.
  const folder = prefix.replace(/\/$/, "");
  const { data: listed } = await db.storage.from(BUCKETS.orderAssets).list(folder, { limit: 1000 });
  const present = new Set((listed ?? []).map((o) => `${folder}/${o.name}`));
  const missing = items.filter((u) => !present.has(u.path));
  if (missing.length) throw new ServiceError(`Upload not found in storage: ${missing.map((m) => m.name).join(", ")}`, 400);

  let clientId: string | null = null;
  let orderId: string | null = null;
  if (target.scope === "client_asset") clientId = target.clientId;
  else {
    orderId = target.orderId;
    const { data } = await db.from("orders").select("client_id").eq("id", orderId).single();
    clientId = data?.client_id ?? null;
  }

  if (target.scope === "order_reference") {
    const { error } = await db.from("client_references").insert(items.map((u) => ({
      order_id: orderId, client_id: clientId, source: "upload", storage_bucket: BUCKETS.orderAssets, storage_path: u.path,
      file_name: u.name, mime_type: u.type ?? null, note: u.note ?? null, created_by: actor.userId ?? null,
    })));
    if (error) throw new ServiceError(error.message, 500);
  } else {
    const kind: AssetKind = target.kind;
    const { error } = await db.from("order_assets").insert(items.map((u) => ({
      order_id: orderId, client_id: clientId, kind, is_approved_face: kind === "face_photo",
      storage_bucket: BUCKETS.orderAssets, storage_path: u.path, file_name: u.name, mime_type: u.type ?? null,
      size_bytes: u.size ?? null, width: u.width ?? null, height: u.height ?? null, created_by: actor.userId ?? null,
    })));
    if (error) throw new ServiceError(error.message, 500);
  }

  await logActivity(db, {
    orderId, actor, action: target.scope === "order_reference" ? "references.uploaded" : "assets.uploaded",
    message: `${items.length} ${target.scope === "order_reference" ? "reference image" : "asset"}${items.length === 1 ? "" : "s"} uploaded`,
    data: { files: items.map((i) => i.name), clientId },
  });
  return items.length;
}

/** Signed read URLs for private storage objects, keyed by path. */
export async function signedUrls(db: DB, bucket: string, paths: (string | null | undefined)[], expiresIn = 3600) {
  const unique = [...new Set(paths.filter((p): p is string => !!p && !p.startsWith("seed/")))];
  if (!unique.length) return {} as Record<string, string>;
  const { data } = await db.storage.from(bucket).createSignedUrls(unique, expiresIn);
  return Object.fromEntries((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path!, d.signedUrl])) as Record<string, string>;
}

export async function deleteAsset(db: DB, assetId: string, actor: Actor) {
  const { data: asset } = await db.from("order_assets").select("*").eq("id", assetId).single();
  if (!asset) throw new ServiceError("Asset not found", 404);
  await db.storage.from(asset.storage_bucket).remove([asset.storage_path]);
  await db.from("order_assets").delete().eq("id", assetId);
  await logActivity(db, { orderId: asset.order_id, actor, action: "asset.deleted", message: `Removed ${asset.file_name}` });
}
