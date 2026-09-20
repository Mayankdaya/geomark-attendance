"use client";

import { cn } from "@/lib/utils";

/**
 * SVG countdown ring — thin hairline arc, serif tabular numerals.
 * Green while healthy, ochre under 2 min, clay under 30 s. No glow.
 */
export function CountdownRing({
  remainingMs,
  totalMs,
  label,
  sublabel,
  size = 168,
}: {
  remainingMs: number;
  totalMs: number;
  label: string;
  sublabel?: string;
  size?: number;
}) {
  const pct = Math.max(0, Math.min(1, remainingMs / totalMs));
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const urgent = remainingMs < 30_000;
  const warn = remainingMs < 120_000 && !urgent;
  const color = urgent
    ? "var(--clay)"
    : warn
      ? "var(--ochre)"
      : "var(--leaf)";

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(29,26,22,0.09)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.4s" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div
            className={cn(
              "font-display tabular-nums text-ink",
              size >= 150 ? "text-[44px]" : "text-[30px]",
            )}
          >
            {label}
          </div>
          {sublabel && <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted">{sublabel}</div>}
        </div>
      </div>
    </div>
  );
}
