import { Radar } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * GeoMark brand — an ink tile with the radar glyph, wordmark set in
 * Instrument Serif with an italic accent. Quiet, editorial, no gradients.
 */
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
    sm: "h-7 w-7 rounded-[6px]",
    md: "h-9 w-9 rounded-[7px]",
    lg: "h-14 w-14 rounded-[10px]",
  }[size];
  const icon = { sm: "h-3.5 w-3.5", md: "h-4.5 w-4.5", lg: "h-7 w-7" }[size];
  const text = { sm: "text-[17px]", md: "text-[21px]", lg: "text-[30px]" }[size];

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className={cn("grid place-items-center bg-ink text-paper", tile)}>
        <Radar className={icon} strokeWidth={2} />
      </div>
      {withWordmark && (
        <span className={cn("font-display leading-none tracking-tight text-ink", text)}>
          Geo<em className="italic">Mark</em>
        </span>
      )}
    </div>
  );
}
