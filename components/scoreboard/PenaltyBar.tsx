"use client";

import { motion } from "framer-motion";
import { MATCH_LOSS_THRESHOLD, TeamId } from "@/engine/types";
import { TEAM_THEME } from "@/lib/teamTheme";
import { cn } from "@/lib/utils";

export function PenaltyBar({ team, penalty }: { team: TeamId; penalty: number }) {
  const theme = TEAM_THEME[team];
  const pct = Math.min(100, (penalty / MATCH_LOSS_THRESHOLD) * 100);
  const danger = penalty >= MATCH_LOSS_THRESHOLD * 0.8;

  return (
    <div className="flex w-full flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className={cn("font-semibold", theme.text)}>{theme.label}</span>
        <span className={cn("font-mono", danger && "text-destructive font-bold")}>
          {penalty} / {MATCH_LOSS_THRESHOLD}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          className={cn("h-full rounded-full", danger ? "bg-destructive" : theme.bg)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  );
}
