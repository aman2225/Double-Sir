"use client";

import { motion } from "framer-motion";
import { Suit } from "@/engine/types";
import { SUIT_META } from "@/lib/teamTheme";
import { GOLD_GLOW } from "@/lib/tableTheme";
import { cn } from "@/lib/utils";

interface TrumpDisplayProps {
  suit: Suit;
}

/** Prominent, persistently-visible trump indicator — floats above the trick area for the rest of the hand once selected. */
export function TrumpDisplay({ suit }: TrumpDisplayProps) {
  const meta = SUIT_META[suit];
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.85 }}
      animate={{ opacity: 1, y: [0, -4, 0], scale: 1 }}
      transition={{ y: { duration: 3, repeat: Infinity, ease: "easeInOut" }, opacity: { duration: 0.3 }, scale: { duration: 0.3 } }}
      className={cn(
        "pointer-events-none absolute -top-3 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-0.5 rounded-2xl border bg-black/50 px-4 py-1.5 backdrop-blur-xl sm:-top-4",
        GOLD_GLOW
      )}
    >
      <span className={cn("text-3xl leading-none sm:text-4xl", meta.color)}>{meta.symbol}</span>
      <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--gold)]">Trump</span>
    </motion.div>
  );
}
