"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface TurnTimerRingProps {
  deadline: number;
  totalSeconds?: number;
  className?: string;
}

const RADIUS = 46;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Circular countdown ring overlaid on a player's avatar. Performance-critical:
 * the smooth sweep mutates the SVG circle's stroke-dashoffset directly via a
 * ref inside a requestAnimationFrame loop (no per-frame React state/render).
 * A separate, much cheaper interval drives only the digit + color threshold,
 * so this component's ticking never propagates a re-render up into the rest
 * of the table.
 */
export function TurnTimerRing({ deadline, totalSeconds = 30, className }: TurnTimerRingProps) {
  const circleRef = useRef<SVGCircleElement | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));

  useEffect(() => {
    let raf: number;
    const tick = () => {
      const remainingMs = Math.max(0, deadline - Date.now());
      const fraction = Math.min(1, remainingMs / (totalSeconds * 1000));
      if (circleRef.current) {
        circleRef.current.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - fraction));
      }
      if (remainingMs > 0) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [deadline, totalSeconds]);

  useEffect(() => {
    const update = () => setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    update();
    const interval = setInterval(update, 250);
    return () => clearInterval(interval);
  }, [deadline]);

  const critical = secondsLeft <= 5;
  const warning = secondsLeft <= 10;
  const color = critical ? "#f87171" : warning ? "#fb923c" : "var(--gold, #facc15)";

  return (
    <div className={cn("pointer-events-none absolute inset-0 z-10", className)}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="6" />
        <circle
          ref={circleRef}
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          className={cn("transition-[stroke] duration-300", critical && "animate-pulse")}
        />
      </svg>
      <span
        className={cn(
          "absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-1.5 py-px text-[10px] font-bold tabular-nums",
          critical ? "text-red-400" : warning ? "text-orange-400" : "text-[var(--gold,#facc15)]"
        )}
      >
        {secondsLeft}s
      </span>
    </div>
  );
}
