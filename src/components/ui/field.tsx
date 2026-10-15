import * as React from "react";
import { Label } from "./label";
import { cn } from "@/lib/utils";

export function Field({ label, htmlFor, hint, error, className, children }: { label: string; htmlFor?: string; hint?: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-[11px] text-danger">{error}</p> : hint ? <p className="text-[11px] text-subtle">{hint}</p> : null}
    </div>
  );
}
