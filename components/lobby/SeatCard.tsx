"use client";

import { motion } from "framer-motion";
import { Crown, WifiOff } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RoomPlayerView } from "@/sockets/events";
import { Seat, teamForSeat } from "@/engine/types";
import { TEAM_THEME } from "@/lib/teamTheme";
import { cn } from "@/lib/utils";

export function SeatCard({ occupant, seat, isSelf }: { occupant?: RoomPlayerView; seat: Seat; isSelf: boolean }) {
  const team = TEAM_THEME[teamForSeat(seat)];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "relative flex flex-col items-center gap-2 rounded-2xl border p-4 backdrop-blur-xl transition-colors",
        occupant ? `bg-card/60 ${team.border}` : "border-dashed border-white/10 bg-white/5",
        isSelf && "ring-2 ring-offset-2 ring-offset-background " + team.ring
      )}
    >
      <span className={cn("absolute left-3 top-3 text-[10px] font-semibold uppercase tracking-wider", team.text)}>
        Seat {seat} · {team.label}
      </span>

      {occupant?.isHost && <Crown className="absolute right-3 top-3 h-4 w-4 text-amber-400" />}

      <Avatar className="mt-4 h-14 w-14">
        <AvatarFallback className={occupant ? team.bg + " text-white" : undefined}>
          {occupant ? occupant.displayName.slice(0, 2).toUpperCase() : "?"}
        </AvatarFallback>
      </Avatar>

      <div className="text-center">
        <p className="text-sm font-medium">{occupant ? occupant.displayName : "Waiting for player..."}</p>
        {occupant && !occupant.connected && (
          <p className="flex items-center justify-center gap-1 text-xs text-destructive">
            <WifiOff className="h-3 w-3" /> Disconnected
          </p>
        )}
      </div>
    </motion.div>
  );
}
