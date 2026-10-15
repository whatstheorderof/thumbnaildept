"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { runAction } from "@/lib/actions";
import { createOrder, transitionOrder, updateOrder, detectCategory, getOrder, type CreateOrderInput } from "@/lib/services/orders";
import { runOrderResearch, setReferenceFlag, type ReferenceFlag } from "@/lib/services/research/pipeline";
import { createRevision } from "@/lib/services/revisions";
import { recordPerformance } from "@/lib/services/performance";
import { isOrderStatus } from "@/lib/domain/status";
import { ServiceError } from "@/lib/services/errors";

const refresh = (jobId?: string) => {
  revalidatePath("/orders");
  revalidatePath("/dashboard");
  if (jobId) revalidatePath(`/orders/${jobId}`);
};

export async function createOrderAction(input: CreateOrderInput) {
  const { db, actor } = await requireUser();
  return runAction(async () => {
    const order = await createOrder(db, input, actor);
    refresh();
    return { id: order.id, jobId: order.job_id };
  });
}

export async function transitionAction(orderId: string, to: string, note?: string) {
  const { db, actor } = await requireUser();
  return runAction(async () => {
    if (!isOrderStatus(to)) throw new ServiceError("Unknown status");
    const o = await transitionOrder(db, orderId, to, actor, note);
    refresh(o.job_id);
    return o.status;
  });
}

export async function updateOrderAction(orderId: string, _: unknown, fd: FormData) {
  const { db, actor } = await requireUser();
  return runAction(async () => {
    const o = await updateOrder(db, orderId, {
      videoTitle: String(fd.get("videoTitle") ?? ""),
      videoDescription: String(fd.get("videoDescription") ?? ""),
      requestedText: String(fd.get("requestedText") ?? ""),
      category: String(fd.get("category") ?? ""),
      clientNotes: String(fd.get("clientNotes") ?? ""),
      thingsToAvoid: String(fd.get("thingsToAvoid") ?? ""),
      deadline: String(fd.get("deadline") ?? "") || null,
    }, actor);
    refresh(o.job_id);
  }, "Saved");
}

export async function detectCategoryAction(orderId: string) {
  const { db, actor } = await requireUser();
  return runAction(async () => {
    const o = await getOrder(db, orderId);
    const r = await detectCategory(db, o, actor);
    refresh(o.job_id);
    return r;
  });
}

export async function runResearchAction(orderId: string) {
  const { db, actor } = await requireUser();
  return runAction(async () => {
    const run = await runOrderResearch(db, orderId, actor);
    const o = await getOrder(db, orderId);
    refresh(o.job_id);
    return { runId: run.id, videos: run.video_count };
  });
}

export async function referenceFlagAction(referenceId: string, flag: ReferenceFlag, value: boolean, jobId: string) {
  const { db, actor } = await requireUser();
  return runAction(async () => {
    await setReferenceFlag(db, referenceId, flag, value, actor);
    revalidatePath(`/orders/${jobId}`);
  });
}

export async function addReferenceUrlsAction(orderId: string, _: unknown, fd: FormData) {
  const { db, actor } = await requireUser();
  return runAction(async () => {
    const urls = String(fd.get("urls") ?? "").split(/\s+/).map((u) => u.trim()).filter(Boolean);
    if (!urls.length) throw new ServiceError("Paste at least one URL");
    for (const u of urls) { try { new URL(u); } catch { throw new ServiceError(`Not a valid URL: ${u}`); } }
    const o = await getOrder(db, orderId);
    const { error } = await db.from("client_references").insert(urls.map((url) => ({ order_id: o.id, client_id: o.client_id, source: "url", url, created_by: actor.userId })));
    if (error) throw new ServiceError(error.message);
    refresh(o.job_id);
  }, "Added");
}

export async function createRevisionAction(orderId: string, _: unknown, fd: FormData) {
  const { db, actor } = await requireUser();
  return runAction(async () => {
    const r = await createRevision(db, orderId, { feedback: String(fd.get("feedback") ?? "") }, actor);
    const o = await getOrder(db, orderId);
    refresh(o.job_id);
    return r.revision_number;
  }, "Revision recorded");
}

export async function recordPerformanceAction(orderId: string, _: unknown, fd: FormData) {
  const { db, actor } = await requireUser();
  const n = (k: string) => { const v = String(fd.get(k) ?? "").replace(/,/g, "").trim(); return v ? Number(v) : null; };
  return runAction(async () => {
    await recordPerformance(db, {
      orderId, videoUrl: String(fd.get("videoUrl") ?? ""), publishedAt: String(fd.get("publishedAt") ?? "") || null,
      impressions: n("impressions"), ctr: n("ctr"), views: n("views"), watchTimeHours: n("watchTimeHours"),
      abTestWinner: fd.get("abTestWinner") === "on" ? true : null, notes: String(fd.get("notes") ?? "") || null,
    }, actor);
    const o = await getOrder(db, orderId);
    refresh(o.job_id);
  }, "Performance saved");
}
