import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium tracking-tight transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.99] cursor-pointer select-none",
  {
    variants: {
      variant: {
        default:
          "bg-leaf border border-leaf-deep/70 text-[#fbfaf6] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_2px_rgba(29,26,22,0.14)] hover:bg-leaf-deep",
        secondary:
          "bg-card border border-line-strong text-ink shadow-[0_1px_2px_rgba(29,26,22,0.05)] hover:bg-paper-deep",
        outline:
          "border border-ink/25 bg-transparent text-ink hover:border-ink/55 hover:bg-ink/[0.03]",
        ghost: "text-ink-soft hover:bg-ink/[0.05] hover:text-ink",
        destructive:
          "bg-clay border border-clay-deep/70 text-[#fdf8f6] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_1px_2px_rgba(29,26,22,0.14)] hover:bg-clay-deep",
        warn: "bg-ochre-tint border border-ochre/30 text-ochre hover:bg-[#efe5c9]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-[5px] px-3 text-[13px]",
        lg: "h-11 px-6 text-[15px]",
        xl: "h-12 px-7 text-[15px]",
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
