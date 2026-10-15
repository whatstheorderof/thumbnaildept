"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2 } from "lucide-react";
import { uploadFiles } from "@/lib/upload-client";
import type { UploadTarget } from "@/lib/services/uploads";
import { cn } from "@/lib/utils";

/** Drop zone that uploads immediately to an existing job/client. */
export function Uploader({ target, label = "Drop files or click to upload", accept = "image/*", compact }: { target: UploadTarget; label?: string; accept?: string; compact?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  async function handle(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    try {
      await uploadFiles(target, [...files], (d, t) => setBusy(`Uploading ${d}/${t}…`));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      <button type="button" onClick={() => input.current?.click()} disabled={!!busy}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files); }}
        className={cn("flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border text-xs text-muted transition-colors hover:border-border-strong hover:text-foreground",
          compact ? "h-10" : "h-20", over && "border-foreground/60 bg-surface-2")}>
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
        {busy ?? label}
      </button>
      <input ref={input} type="file" multiple accept={accept} className="hidden" onChange={(e) => handle(e.target.files)} />
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  );
}
