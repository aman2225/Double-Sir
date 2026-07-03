import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AppSocket } from "@/sockets/client";
import { MusicNotificationAction, MusicState, RepeatMode } from "@/sockets/musicEvents";

export interface MusicNotificationEvent {
  seat: number;
  displayName: string;
  action: MusicNotificationAction;
  trackTitle?: string;
  key: number;
}

interface MusicStoreState extends MusicState {
  socket: AppSocket | null;
  /** Personal, device-local — never synced to other players. */
  volume: number;
  muted: boolean;
  lastNotification: MusicNotificationEvent | null;

  bindToSocket: (socket: AppSocket) => void;
  play: (roomCode: string, trackId?: string) => void;
  pause: (roomCode: string) => void;
  resume: (roomCode: string) => void;
  stop: (roomCode: string) => void;
  next: (roomCode: string) => void;
  previous: (roomCode: string) => void;
  selectTrack: (roomCode: string, trackId: string) => void;
  seek: (roomCode: string, positionMs: number) => void;
  setShuffle: (roomCode: string, enabled: boolean) => void;
  setRepeat: (roomCode: string, mode: RepeatMode) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
}

let notificationKeyCounter = 0;

export const useMusicStore = create<MusicStoreState>()(
  persist(
    (set, get) => ({
      socket: null,
      trackId: null,
      status: "stopped",
      order: [],
      index: 0,
      shuffle: false,
      repeat: "off",
      positionMs: 0,
      playbackStartEpoch: undefined,
      volume: 0.7,
      muted: false,
      lastNotification: null,

      bindToSocket: (socket) => {
        socket.off("music:state");
        socket.off("music:notification");

        socket.on("music:state", (state) => set(state));
        socket.on("music:notification", (payload) =>
          set({ lastNotification: { ...payload, key: notificationKeyCounter++ } })
        );

        set({ socket });
      },

      play: (roomCode, trackId) => get().socket?.emit("music:play", { roomCode, trackId }),
      pause: (roomCode) => get().socket?.emit("music:pause", { roomCode }),
      resume: (roomCode) => get().socket?.emit("music:resume", { roomCode }),
      stop: (roomCode) => get().socket?.emit("music:stop", { roomCode }),
      next: (roomCode) => get().socket?.emit("music:next", { roomCode }),
      previous: (roomCode) => get().socket?.emit("music:previous", { roomCode }),
      selectTrack: (roomCode, trackId) => get().socket?.emit("music:selectTrack", { roomCode, trackId }),
      seek: (roomCode, positionMs) => get().socket?.emit("music:seek", { roomCode, positionMs }),
      setShuffle: (roomCode, enabled) => get().socket?.emit("music:shuffle", { roomCode, enabled }),
      setRepeat: (roomCode, mode) => get().socket?.emit("music:repeat", { roomCode, mode }),

      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
      toggleMute: () => set((s) => ({ muted: !s.muted })),
    }),
    { name: "trick-taking-music-prefs", partialize: (state) => ({ volume: state.volume, muted: state.muted }) }
  )
);

/** Live playback position in ms, derived the same way the turn timer derives remaining time — no server polling. */
export function liveMusicPositionMs(state: Pick<MusicState, "status" | "positionMs" | "playbackStartEpoch">): number {
  if (state.status === "playing" && state.playbackStartEpoch !== undefined) {
    return state.positionMs + (Date.now() - state.playbackStartEpoch);
  }
  return state.positionMs;
}
