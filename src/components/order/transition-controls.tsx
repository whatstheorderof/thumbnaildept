"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { allowedTransitions, STATUS_META, type OrderStatus } from "@/lib/domain/status";
import { transitionAction, runResearchAction } from "@/app/(app)/orders/actions";

/**
 * Status controls for an order. Research runs the real pipeline; other moves
 * are manual transitions validated server-side by the status machine.
 */
export function TransitionControls({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const options = allowedTransitions(status, "user").filter((s) => s !== "CANCELLED" && s !== "RESEARCHING");
  const [target, setTarget] = useState<OrderStatus | "">(options[0] ?? "");
  const canResearch = status === "NEW" || status === "RESEARCH_COMPLETE";
  const canCancel = allowedTransitions(status, "user").includes("CANCELLED");

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => {
    setError(null);
    const r = await fn();
    if (!r.ok) setError(r.error ?? "Failed");
    router.refresh();
  });

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {canResearch && (
          <Button onClick={() => run(() => runResearchAction(orderId))} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : status === "NEW" ? <Play /> : <RotateCw />}
            {status === "NEW" ? "Start research" : "Re-run research"}
          </Button>
        )}
        {options.length > 0 && (
          <div className="flex items-center gap-1">
            <Select aria-label="Move to status" value={target} onChange={(e) => setTarget(e.target.value as OrderStatus)} className="h-8 w-[170px]">
              {options.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </Select>
            <Button variant="secondary" disabled={pending || !target} onClick={() => target && run(() => transitionAction(orderId, target))}>Move</Button>
          </div>
        )}
        {canCancel && (confirmCancel ? (
          <Button variant="danger" disabled={pending} onClick={() => { setConfirmCancel(false); run(() => transitionAction(orderId, "CANCELLED")); }}>Confirm cancel</Button>
        ) : (
          <Button variant="ghost" onClick={() => setConfirmCancel(true)}>Cancel job</Button>
        ))}
      </div>
      {error && <p className="max-w-sm text-right text-xs text-danger">{error}</p>}
    </div>
  );
}
