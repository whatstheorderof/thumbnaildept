"use client";
import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export const Switch = React.forwardRef<React.ElementRef<typeof SwitchPrimitive.Root>, React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>>(
  ({ className, ...props }, ref) => (
    <SwitchPrimitive.Root ref={ref} className={cn("peer inline-flex h-[18px] w-8 shrink-0 cursor-pointer items-center rounded-full border border-border transition-colors data-[state=checked]:bg-accent data-[state=unchecked]:bg-surface-3 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50", className)} {...props}>
      <SwitchPrimitive.Thumb className="pointer-events-none block h-3 w-3 rounded-full shadow transition-transform data-[state=checked]:translate-x-[15px] data-[state=checked]:bg-accent-foreground data-[state=unchecked]:translate-x-[2px] data-[state=unchecked]:bg-muted" />
    </SwitchPrimitive.Root>
  ),
);
Switch.displayName = "Switch";
