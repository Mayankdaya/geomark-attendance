import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Stamp-style badge — like a registrar's ink stamp.
 * Small, rectangular, uppercase, letter-spaced.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-[4px] border px-1.5 py-[3px] text-[10px] font-semibold uppercase leading-none tracking-[0.08em]",
  {
    variants: {
      variant: {
        default: "border-leaf/25 bg-leaf-tint text-leaf-deep",
        secondary: "border-line bg-paper-deep text-muted",
        warning: "border-ochre/30 bg-ochre-tint text-ochre",
        danger: "border-clay/25 bg-clay-tint text-clay",
        outline: "border-line-strong bg-card text-ink-soft",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
