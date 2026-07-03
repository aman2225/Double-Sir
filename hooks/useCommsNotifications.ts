"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Seat } from "@/engine/types";
import { useChatStore } from "@/store/useChatStore";
import { useVoiceStore, PeerConnectionState } from "@/store/useVoiceStore";
import { useUIStore } from "@/store/useUIStore";
import { sounds } from "@/lib/sounds";

/**
 * Lightweight toast notifications for the comms layer — new chat message
 * (only while the chat tab is out of view), emoji reactions, and voice
 * connected/disconnected/muted/unmuted. Mirrors the hooks/useSoundEffects.ts
 * pattern: watches store state transitions rather than subscribing to
 * sockets directly (game-level presence — player joined/left/reconnected —
 * is handled inline in store/useGameStore.ts, right where those events
 * already land).
 */
export function useCommsNotifications(seatNames: Record<Seat, string>) {
  const soundEnabled = useUIStore((s) => s.soundEnabled);
  const commsOpen = useUIStore((s) => s.commsOpen);
  const commsTab = useUIStore((s) => s.commsTab);

  const messages = useChatStore((s) => s.messages);
  const reactions = useChatStore((s) => s.reactions);
  const connectionState = useVoiceStore((s) => s.connectionState);
  const remoteMuted = useVoiceStore((s) => s.remoteMuted);

  const lastMessageCount = useRef(0);
  const lastReactionCount = useRef(0);
  const prevConnectionState = useRef<Map<Seat, PeerConnectionState>>(new Map());
  const prevMuted = useRef<Map<Seat, boolean>>(new Map());

  useEffect(() => {
    if (messages.length > lastMessageCount.current) {
      const chatVisible = commsOpen && commsTab === "chat";
      if (!chatVisible) {
        const latest = messages[messages.length - 1];
        toast.message(`${latest.displayName}: ${latest.text}`, { duration: 3000 });
      }
    }
    lastMessageCount.current = messages.length;
  }, [messages, commsOpen, commsTab]);

  useEffect(() => {
    if (reactions.length > lastReactionCount.current && soundEnabled) sounds.emojiPop();
    lastReactionCount.current = reactions.length;
  }, [reactions.length, soundEnabled]);

  useEffect(() => {
    for (const [seat, state] of connectionState.entries()) {
      const prev = prevConnectionState.current.get(seat);
      if (prev === state) continue;
      const name = seatNames[seat] ?? `Player ${seat}`;
      if (state === "connected" && prev !== "connected") {
        toast.success(`Voice connected: ${name}`);
        if (soundEnabled) sounds.voiceJoin();
      } else if ((state === "failed" || state === "disconnected") && prev === "connected") {
        toast.warning(`Voice disconnected: ${name}`);
        if (soundEnabled) sounds.voiceLeave();
      }
    }
    prevConnectionState.current = new Map(connectionState);
  }, [connectionState, seatNames, soundEnabled]);

  useEffect(() => {
    for (const [seat, muted] of remoteMuted.entries()) {
      const prev = prevMuted.current.get(seat);
      if (prev === undefined || prev === muted) continue;
      const name = seatNames[seat] ?? `Player ${seat}`;
      toast.message(muted ? `${name} muted their mic` : `${name} unmuted their mic`);
      if (soundEnabled) sounds.muteToggle();
    }
    prevMuted.current = new Map(remoteMuted);
  }, [remoteMuted, seatNames, soundEnabled]);
}
