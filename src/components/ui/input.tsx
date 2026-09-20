import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-sm text-zinc-100 shadow-sm transition-colors",
        "placeholder:text-zinc-500 hover:border-white/20 focus:border-emerald-400/60 focus:bg-white/8 focus:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
