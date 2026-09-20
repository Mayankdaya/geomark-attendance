"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn(
        "text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft select-none peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
