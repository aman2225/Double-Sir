"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Crown, Mic, MicOff, WifiOff } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CardBack } from "@/components/cards/CardBack";
import { TeamId } from "@/engine/types";
import { TEAM_THEME } from "@/lib/teamTheme";
import { TablePosition } from "@/lib/seatLayout";
import { GLASS_PANEL } from "@/lib/tableTheme";
import { ConnectionQuality } from "@/sockets/events";
import { EmojiQuickButton } from "@/components/comms/EmojiPicker";
import { TurnTimerRing } from "./TurnTimerRing";
import { cn } from "@/lib/utils";

export type MicState = "speaking" | "muted" | "off";
export type { ConnectionQuality };

const QUALITY_DOT: Record<ConnectionQuality, string> = {
  good: "bg-emerald-400",
  fair: "bg-amber-400",
  poor: "bg-red-500",
};

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
  /** True for the local viewer's own seat — drives the "Your Turn" badge + vibration. */
  isMe?: boolean;
  /** Epoch ms the active player's 30s turn expires — only set for the current-turn seat during card play. */
  turnDeadline?: number | null;
  capturedHands?: number;
  penaltyPoints?: number;
  connectionQuality?: ConnectionQuality;
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
  isMe,
  turnDeadline,
  capturedHands,
  penaltyPoints,
  connectionQuality,
}: PlayerSeatProps) {
  const theme = TEAM_THEME[team];
  const isVertical = position === "left" || position === "right";
  const isSpeaking = micState === "speaking";
  const timerActive = isCurrentTurn && !!turnDeadline;
  const vibratedForDeadline = useRef<number | null>(null);

  useEffect(() => {
    if (!isMe || !timerActive || !turnDeadline) return;
    if (vibratedForDeadline.current === turnDeadline) return;
    const remaining = turnDeadline - Date.now();
    if (remaining <= 0) return;
    const timeout = setTimeout(() => {
      vibratedForDeadline.current = turnDeadline;
      navigator.vibrate?.(200);
    }, Math.max(0, remaining - 5000));
    return () => clearTimeout(timeout);
  }, [isMe, timerActive, turnDeadline]);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative">
        {timerActive && isMe && (
          <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--gold,#facc15)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black shadow">
            Your Turn
          </span>
        )}
        <motion.div
          animate={
            isSpeaking
              ? { boxShadow: ["0 0 0 0 rgba(52,211,153,0)", "0 0 0 6px rgba(52,211,153,0.35)"] }
              : timerActive
              ? { boxShadow: ["0 0 0 0 rgba(250,204,21,0)", "0 0 0 6px rgba(250,204,21,0.25)"] }
              : isCurrentTurn
              ? { boxShadow: ["0 0 0 0 rgba(255,255,255,0)", "0 0 0 6px rgba(255,255,255,0.15)"] }
              : {}
          }
          transition={{ duration: isSpeaking ? 0.7 : timerActive ? 0.9 : 1.2, repeat: isSpeaking || isCurrentTurn ? Infinity : 0, repeatType: "reverse" }}
          className={cn(
            "rounded-full ring-2 ring-offset-2 ring-offset-[var(--felt-deep,transparent)]",
            isSpeaking ? "ring-emerald-400" : timerActive ? "ring-[var(--gold,#facc15)]" : isCurrentTurn ? theme.ring : "ring-transparent"
          )}
        >
          <Avatar className="h-9 w-9 sm:h-12 sm:w-12">
            <AvatarFallback className={cn(theme.bg, "text-white text-xs sm:text-sm")}>
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </motion.div>
        {timerActive && turnDeadline && <TurnTimerRing deadline={turnDeadline} />}
        {isDealer && (
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-background text-[10px] font-bold ring-1 ring-border">
            D
          </span>
        )}
        {isBidWinner && <Crown className="absolute -top-2 -right-1 h-4 w-4 text-[var(--gold,#facc15)] drop-shadow" />}
        {!connected && (
          <span className="absolute -top-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white">
            <WifiOff className="h-3 w-3" />
          </span>
        )}
        {connected && connectionQuality && (
          <span
            className={cn("absolute -bottom-1 -left-1 h-2.5 w-2.5 rounded-full ring-2 ring-background", QUALITY_DOT[connectionQuality])}
            aria-label={`Connection: ${connectionQuality}`}
          />
        )}
        {onQuickEmoji && (
          <EmojiQuickButton
            onSelect={onQuickEmoji}
            className="absolute -bottom-1 -left-1 h-5 w-5 rounded-full bg-background/80 backdrop-blur"
          />
        )}
      </div>

      <div
        className={cn(
          "flex flex-col items-center gap-0.5 rounded-xl border px-2 py-1",
          GLASS_PANEL,
          "border-l-2",
          theme.border
        )}
      >
        <span className={cn("text-xs font-medium max-w-20 truncate sm:max-w-28", theme.text)}>{displayName}</span>
        {micState && (
          <span
            className={cn(
              "flex items-center gap-1 text-[10px]",
              isSpeaking ? "text-emerald-400" : "text-white/70"
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
        {(capturedHands !== undefined || penaltyPoints !== undefined) && (
          <span className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
            {capturedHands !== undefined && <span>🂠 {capturedHands}</span>}
            {penaltyPoints !== undefined && <span>⚠ {penaltyPoints}</span>}
          </span>
        )}
      </div>
    </div>
  );
}
