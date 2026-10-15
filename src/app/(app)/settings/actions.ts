"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { runAction } from "@/lib/actions";
import { updateSetting, CRITIC_DIMENSIONS } from "@/lib/services/settings";
import { ServiceError } from "@/lib/services/errors";

const n = (fd: FormData, k: string) => {
  const v = Number(String(fd.get(k) ?? "").trim());
  if (!Number.isFinite(v)) throw new ServiceError(`${k} must be a number`);
  return v;
};

export async function saveScoringAction(_: unknown, fd: FormData) {
  const { db, user } = await requireUser();
  return runAction(async () => {
    const w = { velocity: n(fd, "velocity"), recency: n(fd, "recency"), outperformance: n(fd, "outperformance"), relevance: n(fd, "relevance"), novelty: n(fd, "novelty") };
    if (Object.values(w).reduce((a, b) => a + b, 0) <= 0) throw new ServiceError("Weights must add up to more than zero");
    await updateSetting(db, "scoring_weights", w, user.id);
    revalidatePath("/settings");
  }, "Scoring weights saved — applies to new research runs");
}

export async function saveCriticAction(_: unknown, fd: FormData) {
  const { db, user } = await requireUser();
  return runAction(async () => {
    const weights = Object.fromEntries(CRITIC_DIMENSIONS.map(([k]) => [k, n(fd, `w_${k}`)]));
    await updateSetting(db, "critic", { rejectBelow: n(fd, "rejectBelow"), reviewFrom: n(fd, "reviewFrom"), weights }, user.id);
    revalidatePath("/settings");
  }, "Critic settings saved");
}

export async function savePricingAction(_: unknown, fd: FormData) {
  const { db, user } = await requireUser();
  return runAction(async () => {
    await updateSetting(db, "pricing", {
      defaultSalePrice: n(fd, "defaultSalePrice"), currency: String(fd.get("currency") ?? "GBP").toUpperCase(), usdToGbp: n(fd, "usdToGbp"),
      marketplaceFeePct: { fiverr: n(fd, "fee_fiverr"), upwork: n(fd, "fee_upwork"), direct: n(fd, "fee_direct"), other: n(fd, "fee_other") },
    }, user.id);
    revalidatePath("/settings");
  }, "Pricing saved");
}

export async function saveResearchAction(_: unknown, fd: FormData) {
  const { db, user } = await requireUser();
  return runAction(async () => {
    await updateSetting(db, "research", { queryCount: n(fd, "queryCount"), maxVideos: n(fd, "maxVideos"), publishedWithinDays: n(fd, "publishedWithinDays"), autoIncludeTop: n(fd, "autoIncludeTop") }, user.id);
    await updateSetting(db, "generation", { candidatesPerConcept: n(fd, "candidatesPerConcept"), width: n(fd, "width"), height: n(fd, "height") }, user.id);
    revalidatePath("/settings");
  }, "Pipeline settings saved");
}
