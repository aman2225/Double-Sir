"use client";

import { motion } from "framer-motion";
import { Crown, Mic, MicOff, WifiOff } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CardBack } from "@/components/cards/CardBack";
import { TeamId } from "@/engine/types";
import { TEAM_THEME } from "@/lib/teamTheme";
import { TablePosition } from "@/lib/seatLayout";
import { EmojiQuickButton } from "@/components/comms/EmojiPicker";
import { cn } from "@/lib/utils";

export type MicState = "speaking" | "muted" | "off";

interface PlayerSeatProps {
  displayName: string;
  team: TeamId;
  position: TablePosition;
  connected: boolean;
  isDealer: boolean;
  isCurrentTurn: boolean;
  cardCount: number;
  bidLabel?: string;
  isBidWinner?: boolean;
  micState?: MicState;
  onQuickEmoji?: (emoji: string) => void;
}

export function PlayerSeat({
  displayName,
  team,
  position,
  connected,
  isDealer,
  isCurrentTurn,
  cardCount,
  bidLabel,
  isBidWinner,
  micState,
  onQuickEmoji,
}: PlayerSeatProps) {
  const theme = TEAM_THEME[team];
  const isVertical = position === "left" || position === "right";
  const isSpeaking = micState === "speaking";

  return (
    <div className={cn("flex flex-col items-center gap-1.5", isVertical && "flex-row gap-2")}>
      <div className="relative">
        <motion.div
          animate={
            isSpeaking
              ? { boxShadow: ["0 0 0 0 rgba(52,211,153,0)", "0 0 0 6px rgba(52,211,153,0.35)"] }
              : isCurrentTurn
              ? { boxShadow: ["0 0 0 0 rgba(255,255,255,0)", "0 0 0 6px rgba(255,255,255,0.15)"] }
              : {}
          }
          transition={{ duration: isSpeaking ? 0.7 : 1.2, repeat: isSpeaking || isCurrentTurn ? Infinity : 0, repeatType: "reverse" }}
          className={cn(
            "rounded-full ring-2 ring-offset-2 ring-offset-background",
            isSpeaking ? "ring-emerald-400" : isCurrentTurn ? theme.ring : "ring-transparent"
          )}
        >
          <Avatar className="h-11 w-11 sm:h-12 sm:w-12">
            <AvatarFallback className={cn(theme.bg, "text-white text-sm")}>
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </motion.div>
        {isDealer && (
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-background text-[10px] font-bold ring-1 ring-border">
            D
          </span>
        )}
        {isBidWinner && <Crown className="absolute -top-2 -right-1 h-4 w-4 text-amber-400 drop-shadow" />}
        {!connected && (
          <span className="absolute -top-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white">
            <WifiOff className="h-3 w-3" />
          </span>
        )}
        {onQuickEmoji && (
          <EmojiQuickButton
            onSelect={onQuickEmoji}
            className="absolute -bottom-1 -left-1 h-5 w-5 rounded-full bg-background/80 backdrop-blur"
          />
        )}
      </div>

      <div className="flex flex-col items-center gap-0.5">
        <span className={cn("text-xs font-medium max-w-20 truncate sm:max-w-28", theme.text)}>{displayName}</span>
        {micState && (
          <span
            className={cn(
              "flex items-center gap-1 text-[10px]",
              isSpeaking ? "text-emerald-400" : "text-muted-foreground"
            )}
          >
            {isSpeaking ? (
              <>
                <Mic className="h-2.5 w-2.5" /> Speaking...
              </>
            ) : micState === "muted" ? (
              <>
                <MicOff className="h-2.5 w-2.5" /> Muted
              </>
            ) : (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" /> Mic Off
              </>
            )}
          </span>
        )}
        {bidLabel && (
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold backdrop-blur">
            {bidLabel}
          </span>
        )}
      </div>

      {!isVertical && (
        <div className="flex -space-x-6">
          {Array.from({ length: Math.min(cardCount, 6) }).map((_, i) => (
            <CardBack key={i} size="sm" />
          ))}
        </div>
      )}
    </div>
  );
}
