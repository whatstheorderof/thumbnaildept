"use client";
import { useState } from "react";
import { cn, hashString } from "@/lib/utils";

/**
 * 16:9 thumbnail tile. With no image (seed data, mocks, files not yet
 * uploaded) it renders a deterministic, clearly-labelled placeholder.
 */
export function Thumbnail({ src, seed, label, className, children, size = "md" }: {
  src?: string | null; seed: string; label?: string; className?: string; children?: React.ReactNode; size?: "sm" | "md" | "lg";
}) {
  const [failed, setFailed] = useState(false);
  const h = hashString(seed);
  const h1 = h % 360, h2 = (h1 + 40 + ((h >>> 9) % 120)) % 360;
  return (
    <div className={cn("relative aspect-video w-full overflow-hidden rounded-md bg-surface-3", className)}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={label ?? ""} className="absolute inset-0 size-full object-cover" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <div className="absolute inset-0" style={{ background: `linear-gradient(${(h >>> 4) % 360}deg, hsl(${h1} 55% 32%), hsl(${h2} 60% 14%))` }}>
          <div className="absolute inset-0 flex flex-col justify-end gap-0.5 p-2">
            <span className="text-[8px] uppercase tracking-[0.12em] text-white/45">Placeholder</span>
            <span className={cn("line-clamp-2 font-semibold leading-tight text-white/85", size === "sm" ? "text-[9px]" : size === "lg" ? "text-base" : "text-[11px]")}>{label}</span>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

export function ScorePill({ value, className }: { value: number | null | undefined; className?: string }) {
  if (value == null) return null;
  return <span className={cn("rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white tabular backdrop-blur", className)}>{Math.round(value)}</span>;
}

