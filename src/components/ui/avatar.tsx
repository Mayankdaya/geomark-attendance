"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";

/** Square initials tile — registrar roster feel instead of a floating circle. */
function Avatar({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      className={cn("relative flex h-9 w-9 shrink-0 overflow-hidden rounded-md", className)}
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      className={cn(
        "flex h-full w-full items-center justify-center rounded-md border border-line bg-paper-deep text-[11px] font-semibold text-ink-soft",
        className,
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarFallback };
