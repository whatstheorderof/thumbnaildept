"use client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { requestUploadsAction, recordUploadsAction } from "@/app/actions/uploads";
import type { UploadTarget } from "@/lib/services/uploads";

async function imageSize(file: File) {
  if (!file.type.startsWith("image/") || file.type.includes("svg")) return {};
  try {
    const bmp = await createImageBitmap(file);
    const out = { width: bmp.width, height: bmp.height };
    bmp.close();
    return out;
  } catch { return {}; }
}

/** Upload files straight to Supabase Storage via server-issued signed URLs, then record them. */
export async function uploadFiles(target: UploadTarget, files: File[], onProgress?: (done: number, total: number) => void) {
  if (!files.length) return 0;
  const signed = await requestUploadsAction(target, files.map((f) => ({ name: f.name, type: f.type || "application/octet-stream", size: f.size })));
  if (!signed.ok) throw new Error(signed.error);
  const supabase = createSupabaseBrowserClient();
  const uploaded: { path: string; name: string; type: string; size: number; width?: number; height?: number }[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i], s = signed.data[i];
    const { error } = await supabase.storage.from(s.bucket).uploadToSignedUrl(s.path, s.token, f, { contentType: s.type });
    if (error) throw new Error(`${f.name}: ${error.message}`);
    uploaded.push({ path: s.path, name: f.name, type: s.type, size: f.size, ...(await imageSize(f)) });
    onProgress?.(i + 1, files.length);
  }
  const rec = await recordUploadsAction(target, uploaded);
  if (!rec.ok) throw new Error(rec.error);
  return rec.data;
}
