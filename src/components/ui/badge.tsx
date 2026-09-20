import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
        secondary: "border-white/10 bg-white/6 text-zinc-300",
        warning: "border-amber-400/25 bg-amber-400/10 text-amber-300",
        danger: "border-rose-400/25 bg-rose-400/10 text-rose-300",
        outline: "border-white/15 text-zinc-300",
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
