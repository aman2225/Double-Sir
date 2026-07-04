"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, AlertTriangle } from "lucide-react";
import { useUIStore } from "@/store/useUIStore";
import { sounds } from "@/lib/sounds";
import { cn } from "@/lib/utils";

interface LocalPlayerTimerProps {
  deadline: number;
  totalSeconds?: number;
  className?: string;
}

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function LocalPlayerTimer({ deadline, totalSeconds = 30, className }: LocalPlayerTimerProps) {
  const circleRef = useRef<SVGCircleElement | null>(null);
  const soundEnabled = useUIStore((s) => s.soundEnabled);
  const lastTickedSecond = useRef<number | null>(null);

  const calculateSecondsLeft = () => Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  const [secondsLeft, setSecondsLeft] = useState(calculateSecondsLeft);

  // High-performance smooth SVG stroke animation via requestAnimationFrame
  useEffect(() => {
    let raf: number;
    const tick = () => {
      const remainingMs = Math.max(0, deadline - Date.now());
      const fraction = Math.min(1, remainingMs / (totalSeconds * 1000));
      if (circleRef.current) {
        circleRef.current.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - fraction));
      }
      if (remainingMs > 0) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [deadline, totalSeconds]);

  // Interval for state thresholds, ticking sounds, and vibration
  useEffect(() => {
    const update = () => {
      const remaining = calculateSecondsLeft();
      setSecondsLeft(remaining);

      // Trigger critical tick sounds & haptics for critical phase (<= 5s)
      if (remaining <= 5 && remaining > 0 && lastTickedSecond.current !== remaining) {
        lastTickedSecond.current = remaining;
        if (soundEnabled) sounds.timerCritical();
        if (typeof window !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate(100);
          } catch {
            // Ignore if vibration is restricted by browser policy
          }
        }
      }
    };

    update();
    const interval = setInterval(update, 200);
    return () => clearInterval(interval);
  }, [deadline, soundEnabled]);

  const critical = secondsLeft <= 5;
  const warning = secondsLeft <= 10 && !critical;

  // Dynamic Ring Colors
  const strokeColor = critical
    ? "#f87171" // Red 400
    : warning
    ? "#fb923c" // Orange 400
    : "#facc15"; // Amber / Gold

  const glowShadow = critical
    ? "shadow-[0_0_24px_rgba(248,113,113,0.7)]"
    : warning
    ? "shadow-[0_0_18px_rgba(251,146,60,0.5)]"
    : "shadow-[0_0_16px_rgba(250,204,21,0.4)]";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.9 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className={cn(
          "pointer-events-none relative flex flex-col items-center justify-center select-none z-30",
          className
        )}
      >
        {/* Top "YOUR TURN" Badge */}
        <motion.div
          animate={
            critical
              ? { scale: [1, 1.08, 1], y: [0, -2, 0] }
              : warning
              ? { scale: [1, 1.04, 1] }
              : {}
          }
          transition={{ repeat: Infinity, duration: critical ? 0.5 : 1 }}
          className={cn(
            "mb-1.5 flex items-center gap-1.5 rounded-full px-3 py-0.5 text-[11px] font-black uppercase tracking-wider shadow-md backdrop-blur-md border border-white/20",
            critical
              ? "bg-red-600/90 text-white shadow-red-500/50"
              : warning
              ? "bg-orange-500/90 text-white shadow-orange-500/40"
              : "bg-[var(--gold,#facc15)] text-black shadow-amber-400/40"
          )}
        >
          {critical ? (
            <AlertTriangle className="h-3.5 w-3.5 animate-bounce" />
          ) : (
            <Clock className="h-3.5 w-3.5" />
          )}
          <span>YOUR TURN</span>
        </motion.div>

        {/* Circular Countdown Ring Container */}
        <div
          className={cn(
            "relative flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-black/80 border border-white/10 backdrop-blur-xl transition-all duration-300",
            glowShadow,
            critical && "animate-pulse"
          )}
        >
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90">
            {/* Background track circle */}
            <circle
              cx="50"
              cy="50"
              r={RADIUS}
              fill="none"
              stroke="rgba(255, 255, 255, 0.12)"
              strokeWidth="7"
            />
            {/* Animated progress stroke circle */}
            <circle
              ref={circleRef}
              cx="50"
              cy="50"
              r={RADIUS}
              fill="none"
              stroke={strokeColor}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              className="transition-[stroke] duration-300"
            />
          </svg>

          {/* Countdown Seconds Text */}
          <div className="flex flex-col items-center justify-center leading-none">
            <span
              className={cn(
                "font-mono text-xl sm:text-2xl font-black tabular-nums tracking-tight drop-shadow",
                critical ? "text-red-400" : warning ? "text-orange-300" : "text-amber-300"
              )}
            >
              {secondsLeft}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-white/60">sec</span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
