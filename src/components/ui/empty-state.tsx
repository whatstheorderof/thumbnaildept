import * as React from "react";
import { cn } from "@/lib/utils";

export function EmptyState({ title, children, phase, className, icon }: { title: string; children?: React.ReactNode; phase?: number; className?: string; icon?: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-12 text-center", className)}>
      {icon && <div className="mb-3 text-subtle [&_svg]:size-5">{icon}</div>}
      {phase && <div className="label-caps mb-2">Phase {phase}</div>}
      <p className="text-[13px] font-medium">{title}</p>
      {children && <div className="mt-1 max-w-md text-xs leading-relaxed text-muted">{children}</div>}
    </div>
  );
}
