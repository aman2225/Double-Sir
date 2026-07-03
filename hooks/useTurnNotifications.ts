"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useGameStore } from "@/store/useGameStore";
import { useUIStore } from "@/store/useUIStore";
import { sounds } from "@/lib/sounds";
import { Seat } from "@/engine/types";
import { SUIT_META } from "@/lib/teamTheme";

/**
 * Toast + sound notifications for the card-play turn timer: turn started
 * (local player only), 10s/5s warnings, and auto-play-on-timeout. Every
 * value here is derived from server-pushed state (`currentTurn` /
 * `turnDeadline` in game:state, `turn:autoPlayed`) — this hook only reacts
 * to it, it never decides anything.
 */
export function useTurnNotifications(mySeat: Seat, seatNames: Record<Seat, string>) {
  const soundEnabled = useUIStore((s) => s.soundEnabled);
  const gameState = useGameStore((s) => s.gameState);
  const lastAutoPlay = useGameStore((s) => s.lastAutoPlay);

  const hand = gameState?.currentHand;
  const currentTurn = hand?.phase === "PLAYING" ? hand.currentTurn : undefined;
  const turnDeadline = hand?.turnDeadline ?? null;

  const prevTurn = useRef<Seat | undefined>(undefined);
  useEffect(() => {
    if (currentTurn === prevTurn.current) return;
    const changed = prevTurn.current !== undefined && currentTurn !== undefined;
    prevTurn.current = currentTurn;
    if (changed && currentTurn === mySeat) {
      toast.message("Your turn!", { duration: 1500 });
      if (soundEnabled) sounds.yourTurn();
    }
  }, [currentTurn, mySeat, soundEnabled]);

  const warnedFor = useRef<number | null>(null);
  const criticalFor = useRef<number | null>(null);
  useEffect(() => {
    if (!turnDeadline) return;
    const interval = setInterval(() => {
      const remaining = turnDeadline - Date.now();
      const who = currentTurn === mySeat ? "You have" : `${seatNames[currentTurn!] ?? "A player"} has`;
      if (remaining <= 10000 && remaining > 5000 && warnedFor.current !== turnDeadline) {
        warnedFor.current = turnDeadline;
        toast.warning(`${who} 10 seconds left!`, { duration: 1500 });
        if (soundEnabled) sounds.timerWarning();
      }
      if (remaining <= 5000 && remaining > 0 && criticalFor.current !== turnDeadline) {
        criticalFor.current = turnDeadline;
        toast.error(`${who} 5 seconds left!`, { duration: 1500 });
        if (soundEnabled) sounds.timerCritical();
      }
    }, 400);
    return () => clearInterval(interval);
  }, [turnDeadline, currentTurn, mySeat, seatNames, soundEnabled]);

  const seenAutoPlay = useRef<number | null>(null);
  useEffect(() => {
    if (!lastAutoPlay || lastAutoPlay.key === seenAutoPlay.current) return;
    seenAutoPlay.current = lastAutoPlay.key;
    const name = seatNames[lastAutoPlay.seat] ?? `Player ${lastAutoPlay.seat}`;
    const meta = SUIT_META[lastAutoPlay.card.suit];
    toast.message(`Time's up — auto-played ${lastAutoPlay.card.rank}${meta.symbol} for ${name}`, { duration: 2500 });
  }, [lastAutoPlay, seatNames]);
}
