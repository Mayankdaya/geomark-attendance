import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-line-strong bg-card px-3 py-2 text-sm text-ink shadow-[0_1px_2px_rgba(29,26,22,0.04)] transition-colors",
        "placeholder:text-faint hover:border-ink/35 focus:border-leaf focus:outline-none focus:ring-[3px] focus:ring-leaf/15",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
