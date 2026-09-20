import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98] cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-emerald-500 to-teal-500 text-emerald-950 shadow-[0_8px_30px_-8px_rgba(16,185,129,0.55)] hover:shadow-[0_10px_38px_-8px_rgba(16,185,129,0.75)] hover:brightness-110",
        secondary:
          "bg-white/8 text-zinc-100 border border-white/10 hover:bg-white/12 hover:border-white/20",
        outline:
          "border border-emerald-400/35 text-emerald-300 hover:bg-emerald-400/10 hover:border-emerald-400/60",
        ghost: "text-zinc-300 hover:bg-white/8 hover:text-zinc-100",
        destructive:
          "bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-[0_8px_30px_-10px_rgba(244,63,94,0.6)] hover:brightness-110",
        warn: "bg-amber-400/15 text-amber-300 border border-amber-400/30 hover:bg-amber-400/25",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-2xl px-7 text-base",
        xl: "h-14 rounded-2xl px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />
  );
}

export { Button, buttonVariants };
