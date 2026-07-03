// Synchronized room-music contract. Socket.IO carries ONLY control events
// and the authoritative state snapshot — actual audio is always streamed
// directly from the server's static file host (public/music/*), never
// through Socket.IO. Every control event is host-only, enforced entirely
// server-side (server/musicHandlers.ts) — a non-host client emitting one
// of these gets InvalidActionError, same trust model as every other
// host-gated action in this app (game:start, hand:continue, ...).

import { Seat } from "@/engine/types";

export type MusicPlaybackStatus = "stopped" | "playing" | "paused";
export type RepeatMode = "off" | "one" | "all";

/**
 * The room's single authoritative music session. Position is tracked the
 * same way the turn timer tracks its deadline: an absolute epoch anchor,
 * never a live "current position" the server has to keep pushing —
 * clients derive the live position locally:
 *   status === "playing" ? positionMs + (Date.now() - playbackStartEpoch) : positionMs
 */
export interface MusicState {
  trackId: string | null;
  status: MusicPlaybackStatus;
  /** Track-id playback order (already shuffled, if shuffle is on). */
  order: string[];
  /** Index into `order` for the current track. */
  index: number;
  shuffle: boolean;
  repeat: RepeatMode;
  /** Frozen position (ms) while paused/stopped; the anchor offset while playing. */
  positionMs: number;
  /** Epoch ms the current "playing" segment started counting from — only meaningful while status === "playing". */
  playbackStartEpoch?: number;
}

export type MusicNotificationAction = "started" | "changed" | "paused" | "resumed" | "stopped";

export interface MusicClientEvents {
  /** Starts playback of the given track (or the current track if omitted) from position 0. */
  "music:play": (payload: { roomCode: string; trackId?: string }) => void;
  "music:pause": (payload: { roomCode: string }) => void;
  "music:resume": (payload: { roomCode: string }) => void;
  "music:stop": (payload: { roomCode: string }) => void;
  "music:next": (payload: { roomCode: string }) => void;
  "music:previous": (payload: { roomCode: string }) => void;
  "music:selectTrack": (payload: { roomCode: string; trackId: string }) => void;
  "music:seek": (payload: { roomCode: string; positionMs: number }) => void;
  "music:shuffle": (payload: { roomCode: string; enabled: boolean }) => void;
  "music:repeat": (payload: { roomCode: string; mode: RepeatMode }) => void;
}

export interface MusicServerEvents {
  "music:state": (state: MusicState) => void;
  "music:notification": (payload: {
    seat: Seat;
    displayName: string;
    action: MusicNotificationAction;
    trackTitle?: string;
  }) => void;
}
