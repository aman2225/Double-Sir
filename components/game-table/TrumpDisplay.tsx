"use client";

import { motion } from "framer-motion";
import { Suit } from "@/engine/types";
import { SUIT_META } from "@/lib/teamTheme";
import { GOLD_GLOW } from "@/lib/tableTheme";
import { cn } from "@/lib/utils";

interface TrumpDisplayProps {
  suit: Suit;
}

/** Prominent, persistently-visible trump indicator — floats at top-left of table for the rest of the hand once selected. */
export function TrumpDisplay({ suit }: TrumpDisplayProps) {
  const meta = SUIT_META[suit];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 25 }}
      className={cn(
        "pointer-events-none absolute top-3 left-3 sm:top-4 sm:left-4 z-20 flex items-center gap-2.5 rounded-2xl border bg-black/60 px-3.5 py-2 backdrop-blur-xl shadow-lg border-[var(--gold,#facc15)]/40",
        GOLD_GLOW
      )}
    >
      <span className={cn("text-2xl sm:text-3xl leading-none select-none", meta.color)}>{meta.symbol}</span>
      <div className="flex flex-col">
        <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--gold)]">Trump</span>
        <span className="text-[11px] font-semibold text-white/90 capitalize leading-tight">{suit.toLowerCase()}</span>
      </div>
    </motion.div>
  );
}
