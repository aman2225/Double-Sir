"use client";

import { motion } from "framer-motion";
import { BidEntry, SEATS, Seat, teamForSeat } from "@/engine/types";
import { TEAM_THEME } from "@/lib/teamTheme";
import { GLASS_PANEL } from "@/lib/tableTheme";
import { cn } from "@/lib/utils";

interface LiveBidTrackProps {
  entries: BidEntry[];
  currentSeat: Seat;
  seatNames: Record<Seat, string>;
  biddingComplete: boolean;
}

export function LiveBidTrack({ entries, currentSeat, seatNames, biddingComplete }: LiveBidTrackProps) {
  const latestBySeat = new Map<Seat, BidEntry>();
  for (const entry of entries) latestBySeat.set(entry.seat, entry);

  return (
    <div className={cn("flex items-center gap-2 rounded-full px-3 py-1.5", GLASS_PANEL)}>
      {SEATS.map((seat) => {
        const entry = latestBySeat.get(seat);
        const team = TEAM_THEME[teamForSeat(seat)];
        const isActive = !biddingComplete && seat === currentSeat;
        return (
          <div key={seat} className="flex flex-col items-center gap-0.5">
            <span className={cn("text-[10px] font-medium max-w-14 truncate", team.text)}>{seatNames[seat] ?? `P${seat}`}</span>
            <motion.span
              animate={isActive ? { scale: [1, 1.12, 1] } : {}}
              transition={{ duration: 1, repeat: isActive ? Infinity : 0 }}
              className={cn(
                "flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-semibold",
                isActive
                  ? "bg-[var(--gold)] text-black shadow-[0_0_10px_var(--gold-soft)]"
                  : entry?.value !== undefined
                  ? "bg-white/15 text-white"
                  : entry
                  ? "bg-white/5 text-white/60 line-through"
                  : "bg-white/5 text-white/60"
              )}
            >
              {entry ? (entry.value !== undefined ? entry.value : "Pass") : "-"}
            </motion.span>
          </div>
        );
      })}
    </div>
  );
}
