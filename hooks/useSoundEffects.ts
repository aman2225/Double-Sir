"use client";

import { useEffect } from "react";
import { useGameStore } from "@/store/useGameStore";
import { useUIStore } from "@/store/useUIStore";
import { sounds } from "@/lib/sounds";

/** Wires key realtime game events to synthesized sound cues, respecting the user's sound toggle. */
export function useSoundEffects() {
  const soundEnabled = useUIStore((s) => s.soundEnabled);
  const lastTrickEvent = useGameStore((s) => s.lastTrickEvent);
  const lastHandComplete = useGameStore((s) => s.lastHandComplete);
  const lastMatchComplete = useGameStore((s) => s.lastMatchComplete);
  const lastError = useGameStore((s) => s.lastError);

  useEffect(() => {
    if (!soundEnabled || !lastTrickEvent) return;
    sounds.trickWin();
    if (lastTrickEvent.handsCollected) {
      const timeout = setTimeout(() => sounds.handsCollected(), 200);
      return () => clearTimeout(timeout);
    }
  }, [soundEnabled, lastTrickEvent]);

  useEffect(() => {
    if (!soundEnabled || !lastHandComplete) return;
    sounds.penalty();
  }, [soundEnabled, lastHandComplete]);

  useEffect(() => {
    if (!soundEnabled || !lastMatchComplete) return;
    sounds.matchWin();
  }, [soundEnabled, lastMatchComplete]);

  useEffect(() => {
    if (!soundEnabled || !lastError) return;
    sounds.error();
  }, [soundEnabled, lastError]);
}
