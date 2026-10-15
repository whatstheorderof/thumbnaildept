"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Wand2, Loader2 } from "lucide-react";
import { detectCategoryAction } from "@/app/(app)/orders/actions";

export function DetectCategoryButton({ orderId }: { orderId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button type="button" disabled={pending} onClick={() => start(async () => { await detectCategoryAction(orderId); router.refresh(); })}
      className="inline-flex items-center gap-1 text-[11px] text-subtle hover:text-foreground" title="Detect category with Claude">
      {pending ? <Loader2 className="size-3 animate-spin" /> : <Wand2 className="size-3" />}Detect
    </button>
  );
}
