import type { DB, GenerationRow } from "@/lib/types/db";
import type { CompletedGeneration } from "@/lib/adapters/leonardo";
import { logActivity } from "./activity";
import { recordCost } from "./costs";
import { transitionOrder } from "./orders";
import { BUCKETS } from "./uploads";

/**
 * Apply a completed Leonardo generation (from the webhook, or a manual
 * fetch): store image copies, mark the generation, and when every
 * generation for the order is finished, move it to GENERATIONS_READY.
 */
export async function applyCompletedGeneration(db: DB, done: CompletedGeneration) {
  const { data: gen } = await db.from("generations").select("*").eq("provider", "leonardo").eq("provider_generation_id", done.providerGenerationId).maybeSingle();
  if (!gen) return { matched: false as const };
  const g = gen as GenerationRow;
  if (g.status === "complete" || g.status === "failed") return { matched: true as const, duplicate: true };

  const now = new Date();
  let stored = 0;
  for (const img of done.images) {
    let storagePath: string | null = null;
    try {
      const res = await fetch(img.url, { signal: AbortSignal.timeout(20_000) });
      if (res.ok) {
        const ext = (res.headers.get("content-type") ?? "image/jpeg").includes("png") ? "png" : "jpg";
        storagePath = `orders/${g.order_id}/generations/${g.id}/${img.providerImageId}.${ext}`;
        const { error } = await db.storage.from(BUCKETS.generations).upload(storagePath, new Uint8Array(await res.arrayBuffer()), { contentType: res.headers.get("content-type") ?? "image/jpeg", upsert: true });
        if (error) storagePath = null; else stored++;
      }
    } catch (e) {
      console.warn("[generations] download failed", img.url, e);
    }
    await db.from("generation_images").insert({
      generation_id: g.id, provider_image_id: img.providerImageId, source_url: img.url, storage_bucket: BUCKETS.generations,
      storage_path: storagePath, width: img.width ?? null, height: img.height ?? null, nsfw: img.nsfw,
    });
  }

  await db.from("generations").update({
    status: done.status, error: done.error ?? null, completed_at: now.toISOString(),
    generation_time_ms: g.requested_at ? now.getTime() - new Date(g.requested_at).getTime() : null,
  }).eq("id", g.id);
  if (g.cost != null) await recordCost(db, { orderId: g.order_id, provider: "leonardo", operation: "generation", cost: Number(g.cost), units: { images: done.images.length, generationId: g.provider_generation_id }, mode: g.source_mode });

  await logActivity(db, { orderId: g.order_id, actor: { type: "system", label: "leonardo-webhook" }, action: `generation.${done.status}`, message: `Generation ${done.status}: ${done.images.length} image(s), ${stored} stored` });

  const { data: pending } = await db.from("generations").select("id").eq("order_id", g.order_id).in("status", ["queued", "pending"]);
  const { data: order } = await db.from("orders").select("status").eq("id", g.order_id).single();
  if (!pending?.length && order?.status === "GENERATING") {
    await transitionOrder(db, g.order_id, "GENERATIONS_READY", { type: "system", label: "leonardo-webhook" });
  }
  return { matched: true as const, duplicate: false, stored };
}
