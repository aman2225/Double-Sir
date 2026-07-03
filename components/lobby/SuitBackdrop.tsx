"use client";

import { motion } from "framer-motion";

const GLYPHS = [
  { symbol: "♠", top: "8%", left: "6%", size: 120, delay: 0 },
  { symbol: "♥", top: "62%", left: "88%", size: 160, delay: 0.4 },
  { symbol: "♦", top: "78%", left: "10%", size: 100, delay: 0.8 },
  { symbol: "♣", top: "14%", left: "82%", size: 140, delay: 1.2 },
];

/** Subtle floating suit glyphs used behind hero/auth screens for a premium felt-table feel. */
export function SuitBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {GLYPHS.map((g) => (
        <motion.span
          key={g.symbol}
          className="absolute font-serif text-white/[0.04] select-none"
          style={{ top: g.top, left: g.left, fontSize: g.size }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: [0, -16, 0] }}
          transition={{ duration: 8, delay: g.delay, repeat: Infinity, ease: "easeInOut" }}
        >
          {g.symbol}
        </motion.span>
      ))}
    </div>
  );
}
