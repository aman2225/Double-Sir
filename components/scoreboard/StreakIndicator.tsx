"use client";

import { motion } from "framer-motion";
import { Flame, Layers } from "lucide-react";
import { StreakState } from "@/engine/types";
import { GLASS_PANEL } from "@/lib/tableTheme";
import { cn } from "@/lib/utils";

export function StreakIndicator({ streak, seatNames }: { streak: StreakState; seatNames: Record<number, string> }) {
  const playerName = streak.currentStreakPlayer ? seatNames[streak.currentStreakPlayer] ?? `P${streak.currentStreakPlayer}` : null;

  return (
    <div className={cn("flex items-center gap-2 rounded-full px-3 py-1.5 text-xs", GLASS_PANEL)}>
      <Layers className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-muted-foreground">Unclaimed:</span>
      <motion.span
        key={streak.unclaimedHands}
        initial={{ scale: 1.3 }}
        animate={{ scale: 1 }}
        className="font-mono font-semibold"
      >
        {streak.unclaimedHands}
      </motion.span>
      {playerName && (
        <span
          className={cn(
            "flex items-center gap-1 rounded-full bg-primary/20 px-2 py-0.5 font-medium text-primary",
            streak.streakEstablished && "animate-pulse bg-amber-500/20 text-amber-400"
          )}
          title={streak.streakEstablished ? "Hot streak — every trick this player wins is captured instantly" : undefined}
        >
          {streak.streakEstablished && <Flame className="h-3 w-3" />}
          {playerName} × {streak.currentStreakCount}
        </span>
      )}
    </div>
  );
}
