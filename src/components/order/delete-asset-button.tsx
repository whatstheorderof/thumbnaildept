"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteAssetAction } from "@/app/actions/uploads";

export function DeleteAssetButton({ assetId }: { assetId: string }) {
  const [armed, setArmed] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button type="button" disabled={pending} title={armed ? "Click again to delete" : "Delete"}
      onClick={() => { if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 3000); return; } start(async () => { await deleteAssetAction(assetId); router.refresh(); }); }}
      className={`ml-auto rounded p-0.5 ${armed ? "text-danger" : "text-subtle hover:text-foreground"}`}>
      <Trash2 className="size-3" />
    </button>
  );
}
