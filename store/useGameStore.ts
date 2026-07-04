import { create } from "zustand";
import { toast } from "sonner";
import { Card, Suit, TrickResult, StreakState, TeamId, Seat } from "@/engine/types";
import { getSocket, AppSocket } from "@/sockets/client";
import { ConnectionQuality, PublicMatchState, RoomStateView } from "@/sockets/events";
import { useChatStore } from "./useChatStore";
import { useVoiceStore } from "./useVoiceStore";
import { useMusicStore } from "./useMusicStore";
import { useWalletStore } from "./useWalletStore";

function bucketLatency(rttMs: number): ConnectionQuality {
  if (rttMs < 150) return "good";
  if (rttMs < 400) return "fair";
  return "poor";
}

let pingInterval: ReturnType<typeof setInterval> | null = null;

export interface TrickResolvedEvent {
  trick: TrickResult;
  streak: StreakState;
  handsCollected?: { team: TeamId; count: number };
  key: number;
}

export interface HandCompleteEvent {
  bidderSeat: Seat;
  declaredBid: number;
  biddingTeam: TeamId;
  bidSuccess: boolean;
  penaltyApplied: number;
  penaltyTeam: TeamId;
  teamAHands: number;
  teamBHands: number;
  teamAPenalty: number;
  teamBPenalty: number;
  earlyBreak?: boolean;
  earlyBreakReason?: string;
  key: number;
}

export interface MatchCompleteEvent {
  winningTeam: TeamId;
  teamAPenalty: number;
  teamBPenalty: number;
  handsPlayed: number;
  prizePerWinner: number;
  key: number;
}

export interface AutoPlayEvent {
  seat: Seat;
  card: Card;
  key: number;
}

interface GameStoreState {
  socket: AppSocket | null;
  connected: boolean;
  roomState: RoomStateView | null;
  gameState: PublicMatchState | null;
  lastError: string | null;
  lastTrickEvent: TrickResolvedEvent | null;
  lastHandComplete: HandCompleteEvent | null;
  lastMatchComplete: MatchCompleteEvent | null;
  lastAutoPlay: AutoPlayEvent | null;
  /** Self-measured round-trip quality per seat, broadcast by each client. */
  connectionQualityBySeat: Map<Seat, ConnectionQuality>;
  /** Tracked so a dropped connection can silently rejoin the same seat once Socket.IO auto-reconnects. */
  currentRoomCode: string | null;
  currentDisplayName: string | null;

  connect: (token: string) => void;
  disconnect: () => void;

  createRoom: (displayName: string, entryFee: number, roomName?: string) => Promise<{ ok: boolean; roomCode?: string; error?: string }>;
  joinRoom: (roomCode: string, displayName: string) => Promise<{ ok: boolean; roomCode?: string; error?: string }>;
  leaveRoom: (roomCode: string) => void;
  startGame: (roomCode: string) => void;
  placeBid: (roomCode: string, value: number | undefined) => void;
  selectTrump: (roomCode: string, suit: Suit) => void;
  playCard: (roomCode: string, card: Card) => void;
  continueHand: (roomCode: string) => void;
  playAgain: (roomCode: string) => void;
  newMatch: (roomCode: string) => void;
  clearError: () => void;
}

let eventKeyCounter = 0;

export const useGameStore = create<GameStoreState>((set, get) => ({
  socket: null,
  connected: false,
  roomState: null,
  gameState: null,
  lastError: null,
  lastTrickEvent: null,
  lastHandComplete: null,
  lastMatchComplete: null,
  lastAutoPlay: null,
  connectionQualityBySeat: new Map(),
  currentRoomCode: null,
  currentDisplayName: null,

  connect: (token: string) => {
    const existing = get().socket;
    if (existing?.connected) return;

    const socket = getSocket(token);

    socket.off();
    socket.on("connect", () => {
      set({ connected: true });
      // Silently rejoin the same seat after a dropped connection auto-reconnects.
      const { currentRoomCode, currentDisplayName } = get();
      if (currentRoomCode && currentDisplayName) {
        socket.emit("room:join", { roomCode: currentRoomCode, displayName: currentDisplayName }, () => {});
      }
    });
    socket.on("disconnect", () => set({ connected: false }));
    socket.on("room:state", (roomState) => set({ roomState }));
    socket.on("game:state", (gameState) => set({ gameState }));
    socket.on("bid:updated", () => {});
    socket.on("bidding:complete", () => {});
    socket.on("trump:selected", () => {});
    socket.on("trick:resolved", (payload) =>
      set({ lastTrickEvent: { ...payload, key: eventKeyCounter++ } })
    );
    socket.on("hand:complete", (payload) =>
      set({ lastHandComplete: { ...payload, key: eventKeyCounter++ } })
    );
    socket.on("match:complete", (payload) =>
      set({ lastMatchComplete: { ...payload, key: eventKeyCounter++ } })
    );
    socket.on("player:joined", ({ displayName }) => toast.message(`${displayName} joined the room`));
    socket.on("player:left", ({ displayName }) => toast.message(`${displayName} left the room`));
    socket.on("player:disconnected", ({ seat }) => {
      const name = get().roomState?.players.find((p) => p.seat === seat)?.displayName ?? "A player";
      toast.warning(`${name} disconnected`);
    });
    socket.on("player:reconnected", ({ seat }) => {
      const name = get().roomState?.players.find((p) => p.seat === seat)?.displayName ?? "A player";
      toast.success(`${name} reconnected`);
    });
    socket.on("error:invalidMove", (payload) => set({ lastError: payload.message }));
    socket.on("connection:quality", ({ seat, quality }) =>
      set((s) => ({ connectionQualityBySeat: new Map(s.connectionQualityBySeat).set(seat, quality) }))
    );
    socket.on("turn:autoPlayed", (payload) => set({ lastAutoPlay: { ...payload, key: eventKeyCounter++ } }));

    // Lightweight self-measured latency ping, broadcast as a 3-tier quality
    // so every seat's panel can show a real (not decorative) connection dot.
    if (pingInterval) clearInterval(pingInterval);
    let lastReportedQuality: ConnectionQuality | null = null;
    const pingOnce = () => {
      const { currentRoomCode } = get();
      if (!socket.connected || !currentRoomCode) return;
      const sentAt = Date.now();
      socket.emit("ping:latency", () => {
        const quality = bucketLatency(Date.now() - sentAt);
        if (quality === lastReportedQuality) return;
        lastReportedQuality = quality;
        socket.emit("connection:quality", { roomCode: currentRoomCode, quality });
      });
    };
    pingOnce();
    pingInterval = setInterval(pingOnce, 8000);

    // Every comms concern (chat/emoji + WebRTC voice signaling) is
    // multiplexed over this same authenticated connection — wire their
    // listeners here too, right after the game listeners, so there's a
    // single connection lifecycle instead of scattered ad-hoc binding.
    useChatStore.getState().bindToSocket(socket);
    useVoiceStore.getState().bindToSocket(socket);
    useMusicStore.getState().bindToSocket(socket);
    useWalletStore.getState().bindToSocket(socket);

    set({ socket, connected: socket.connected });
  },

  disconnect: () => {
    if (useVoiceStore.getState().voiceEnabled) useVoiceStore.getState().disableVoice();
    useChatStore.getState().clear();
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
    get().socket?.disconnect();
    set({
      socket: null,
      connected: false,
      roomState: null,
      gameState: null,
      connectionQualityBySeat: new Map(),
      currentRoomCode: null,
      currentDisplayName: null,
    });
  },

  createRoom: (displayName, entryFee, roomName) =>
    new Promise((resolve) => {
      const socket = get().socket;
      if (!socket) {
        resolve({ ok: false, error: "Not connected." });
        return;
      }
      socket.emit("room:create", { displayName, entryFee, roomName }, (res) => {
        if (res.ok && res.data?.roomCode) set({ currentRoomCode: res.data.roomCode, currentDisplayName: displayName });
        resolve({ ok: res.ok, roomCode: res.data?.roomCode, error: res.error });
      });
    }),

  joinRoom: (roomCode, displayName) =>
    new Promise((resolve) => {
      const socket = get().socket;
      if (!socket) {
        resolve({ ok: false, error: "Not connected." });
        return;
      }
      socket.emit("room:join", { roomCode, displayName }, (res) => {
        if (res.ok && res.data?.roomCode) set({ currentRoomCode: res.data.roomCode, currentDisplayName: displayName });
        resolve({ ok: res.ok, roomCode: res.data?.roomCode, error: res.error });
      });
    }),

  leaveRoom: (roomCode) => {
    get().socket?.emit("room:leave", { roomCode });
    if (useVoiceStore.getState().voiceEnabled) useVoiceStore.getState().disableVoice();
    useChatStore.getState().clear();
    set({ currentRoomCode: null, currentDisplayName: null, roomState: null, gameState: null });
  },
  startGame: (roomCode) => get().socket?.emit("game:start", { roomCode }),
  placeBid: (roomCode, value) => get().socket?.emit("bid:place", { roomCode, value }),
  selectTrump: (roomCode, suit) => get().socket?.emit("trump:select", { roomCode, suit }),
  playCard: (roomCode, card) => get().socket?.emit("card:play", { roomCode, card }),
  continueHand: (roomCode) => get().socket?.emit("hand:continue", { roomCode }),
  playAgain: (roomCode) => get().socket?.emit("match:playAgain", { roomCode }),
  newMatch: (roomCode) => get().socket?.emit("match:newMatch", { roomCode }),
  clearError: () => set({ lastError: null }),
}));
