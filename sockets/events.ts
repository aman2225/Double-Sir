// Shared Socket.IO event contract. Both the server (server/socketHandlers.ts)
// and the client (sockets/client.ts, and everything downstream in
// store/useGameStore.ts) import from here so payload shapes can never drift
// apart between the two sides.

import { BidEntry, Card, Seat, StreakState, Suit, TeamId, TrickResult } from "@/engine/types";
import { ChatClientEvents, ChatServerEvents } from "./chatEvents";
import { VoiceClientEvents, VoiceServerEvents } from "./voiceEvents";
import { EmojiClientEvents, EmojiServerEvents } from "./emojiEvents";
import { PresenceServerEvents } from "./presenceEvents";

export type RoomStatus = "LOBBY" | "BIDDING" | "TRUMP_SELECT" | "PLAYING" | "HAND_COMPLETE" | "MATCH_COMPLETE";

/** Self-measured (client -> server RTT) connection quality, broadcast so every seat's panel can show it. */
export type ConnectionQuality = "good" | "fair" | "poor";

export interface RoomPlayerView {
  seat: Seat;
  team: TeamId;
  playerProfileId: string;
  displayName: string;
  avatarUrl?: string;
  connected: boolean;
  isHost: boolean;
}

export interface RoomStateView {
  roomCode: string;
  status: RoomStatus;
  players: RoomPlayerView[];
  hostPlayerProfileId: string;
}

/**
 * The authoritative game state as seen by ONE specific seat: other players'
 * hands are redacted to a card count, only the viewer's own hand is fully
 * revealed. See sockets/redact.ts for how this is derived from engine
 * HandState.
 */
export interface PublicPlayerHand {
  seat: Seat;
  cardCount: number;
  /** Only populated for the viewing player's own seat. */
  hand?: Card[];
}

export interface PublicHandState {
  handNumber: number;
  dealerSeat: Seat;
  phase: "BIDDING" | "TRUMP_SELECTION" | "PLAYING" | "COMPLETE";
  players: PublicPlayerHand[];
  bidding: {
    entries: BidEntry[];
    currentSeat: Seat;
    highestBid?: { seat: Seat; value: number };
    phase: "AWAITING_PLAYER1" | "IN_PROGRESS" | "COMPLETE";
  };
  trumpSuit?: Suit;
  currentTrick: { seat: Seat; card: Card }[];
  leadSuit?: Suit;
  currentTurn: Seat;
  tricksPlayedCount: number;
  streak: StreakState;
  /** Epoch ms the active player's 30s card-play turn expires, or null when no turn timer is running. */
  turnDeadline: number | null;
}

export interface PublicMatchState {
  roomCode: string;
  teamAPenalty: number;
  teamBPenalty: number;
  dealerSeat: Seat;
  handNumber: number;
  winningTeam?: TeamId;
  currentHand?: PublicHandState;
}

// --- Client -> Server --------------------------------------------------
// The player's identity token is verified once, at connection time, in a
// Socket.IO `io.use` handshake middleware (see server/socketHandlers.ts) —
// individual events below don't need to carry it.

export interface GameClientEvents {
  "room:create": (payload: { displayName: string }, ack: (res: AckResult<{ roomCode: string }>) => void) => void;
  "room:join": (payload: { roomCode: string; displayName: string }, ack: (res: AckResult<{ roomCode: string }>) => void) => void;
  "room:leave": (payload: { roomCode: string }) => void;
  "game:start": (payload: { roomCode: string }) => void;
  "bid:place": (payload: { roomCode: string; value?: number }) => void;
  "trump:select": (payload: { roomCode: string; suit: Suit }) => void;
  "card:play": (payload: { roomCode: string; card: Card }) => void;
  "hand:continue": (payload: { roomCode: string }) => void;
  "match:playAgain": (payload: { roomCode: string }) => void;
  "match:newMatch": (payload: { roomCode: string }) => void;
  "ping:latency": (ack: (ok: true) => void) => void;
  "connection:quality": (payload: { roomCode: string; quality: ConnectionQuality }) => void;
}

export interface AckResult<T> {
  ok: boolean;
  error?: string;
  data?: T;
}

// --- Server -> Client ----------------------------------------------------

export interface GameServerEvents {
  "room:state": (state: RoomStateView) => void;
  "game:state": (state: PublicMatchState) => void;
  "bid:updated": (entry: BidEntry) => void;
  "bidding:complete": (payload: { winningSeat: Seat; value: number }) => void;
  "trump:selected": (payload: { suit: Suit }) => void;
  "trick:resolved": (payload: {
    trick: TrickResult;
    streak: StreakState;
    handsCollected?: { team: TeamId; count: number };
  }) => void;
  "hand:complete": (payload: {
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
  }) => void;
  "match:complete": (payload: {
    winningTeam: TeamId;
    teamAPenalty: number;
    teamBPenalty: number;
    handsPlayed: number;
  }) => void;
  "player:disconnected": (payload: { seat: Seat }) => void;
  "player:reconnected": (payload: { seat: Seat }) => void;
  "error:invalidMove": (payload: { message: string }) => void;
  "connection:quality": (payload: { seat: Seat; quality: ConnectionQuality }) => void;
  /** A player's 30s card-play turn expired and the server played on their behalf. */
  "turn:autoPlayed": (payload: { seat: Seat; card: Card }) => void;
}

// --- Combined contract -----------------------------------------------------
// The full wire contract multiplexed over the single authenticated Socket.IO
// connection: game events plus the chat/voice/emoji/presence event groups
// added for real-time communication. Each group has its own file above so
// the concerns stay separable even though they share one transport.

export type ClientToServerEvents = GameClientEvents & ChatClientEvents & VoiceClientEvents & EmojiClientEvents;

export type ServerToClientEvents = GameServerEvents &
  ChatServerEvents &
  VoiceServerEvents &
  EmojiServerEvents &
  PresenceServerEvents;
