"use client";

import { cn } from "@/lib/utils";

/**
 * SVG countdown ring — shows session time remaining with a progress arc.
 * Emerald while healthy, amber under 2 min, rose under 30 s.
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
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const urgent = remainingMs < 30_000;
  const warn = remainingMs < 120_000 && !urgent;
  const color = urgent ? "var(--danger)" : warn ? "var(--warning)" : "var(--primary)";
  const glow = urgent
    ? "0 0 30px rgba(251,113,133,0.4)"
    : warn
      ? "0 0 30px rgba(251,191,36,0.4)"
      : "0 0 30px rgba(52,211,153,0.4)";

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
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
          style={{ filter: `drop-shadow(${glow})`, transition: "stroke-dashoffset 0.9s linear, stroke 0.4s" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div
            className={cn(
              "font-display font-bold tabular-nums",
              size >= 150 ? "text-4xl" : "text-3xl",
            )}
            style={{ color }}
          >
            {label}
          </div>
          {sublabel && <div className="mt-1 text-[11px] uppercase tracking-widest text-zinc-500">{sublabel}</div>}
        </div>
      </div>
    </div>
  );
}
