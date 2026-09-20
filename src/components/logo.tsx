import { Radar } from "lucide-react";
import { cn } from "@/lib/utils";

/** GeoMark brand mark — radar glyph in an emerald gradient tile. */
export function Logo({
  size = "md",
  withWordmark = true,
  className,
}: {
  size?: "sm" | "md" | "lg";
  withWordmark?: boolean;
  className?: string;
}) {
  const tile = {
    sm: "h-8 w-8 rounded-lg",
    md: "h-10 w-10 rounded-xl",
    lg: "h-14 w-14 rounded-2xl",
  }[size];
  const icon = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-7 w-7" }[size];
  const text = { sm: "text-base", md: "text-lg", lg: "text-2xl" }[size];

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "grid place-items-center bg-gradient-to-br from-emerald-400 to-teal-600 text-emerald-950 shadow-[0_8px_24px_-6px_rgba(16,185,129,0.6)]",
          tile,
        )}
      >
        <Radar className={icon} strokeWidth={2.4} />
      </div>
      {withWordmark && (
        <div className="leading-none">
          <span className={cn("font-display font-bold tracking-tight text-zinc-50", text)}>
            Geo
          </span>
          <span className={cn("font-display font-bold tracking-tight text-gradient", text)}>
            Mark
          </span>
        </div>
      )}
    </div>
  );
}
