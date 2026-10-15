import { STATUS_META, PIPELINE, pipelineIndex, type OrderStatus } from "@/lib/domain/status";
import { cn } from "@/lib/utils";

const toneVar = (s: OrderStatus) => `var(--tone-${STATUS_META[s].tone})`;

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded border border-border bg-surface-2 px-1.5 py-px text-[11px] font-medium", className)}>
      <span className="size-1.5 rounded-full" style={{ background: toneVar(status) }} />
      {STATUS_META[status].label}
    </span>
  );
}

export function StatusDot({ status }: { status: OrderStatus }) {
  return <span className="inline-block size-1.5 rounded-full" style={{ background: toneVar(status) }} title={STATUS_META[status].label} />;
}

/** Full production-state bar shown at the top of every order. */
export function PipelineBar({ status }: { status: OrderStatus }) {
  const idx = pipelineIndex(status);
  return (
    <div className="w-full">
      <div className="flex gap-[3px]">
        {PIPELINE.map((s, i) => (
          <div key={s} className="group relative flex-1">
            <div className={cn("h-1 rounded-full", i < idx ? "bg-foreground/70" : i === idx ? "" : "bg-surface-3")}
              style={i === idx ? { background: toneVar(status) } : undefined} />
            <div className={cn("mt-1.5 truncate text-[10px] max-xl:hidden", i === idx ? "text-foreground" : "text-subtle")}>{STATUS_META[s].short}</div>
          </div>
        ))}
      </div>
      {(status === "REVISION" || status === "CANCELLED") && (
        <p className="mt-2 text-[11px]" style={{ color: toneVar(status) }}>{STATUS_META[status].label} — {STATUS_META[status].description}</p>
      )}
    </div>
  );
}
