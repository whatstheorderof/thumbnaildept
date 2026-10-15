"use server";
import { requireUser } from "@/lib/auth/session";
import { runAction } from "@/lib/actions";
import { createSignedUploads, recordUploads, deleteAsset, uploadTargetSchema, type UploadTarget } from "@/lib/services/uploads";
import { revalidatePath } from "next/cache";

export async function requestUploadsAction(target: UploadTarget, files: { name: string; type: string; size: number }[]) {
  const { db } = await requireUser();
  return runAction(() => createSignedUploads(db, uploadTargetSchema.parse(target), files));
}

export async function recordUploadsAction(target: UploadTarget, uploads: { path: string; name: string; type?: string; size?: number; width?: number; height?: number }[]) {
  const { db, actor } = await requireUser();
  return runAction(async () => {
    const n = await recordUploads(db, uploadTargetSchema.parse(target), uploads, actor);
    revalidatePath("/orders", "layout");
    revalidatePath("/clients", "layout");
    return n;
  });
}

export async function deleteAssetAction(assetId: string) {
  const { db, actor } = await requireUser();
  return runAction(async () => {
    await deleteAsset(db, assetId, actor);
    revalidatePath("/orders", "layout");
    revalidatePath("/clients", "layout");
  });
}
