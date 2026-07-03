// In-memory representation of one live room: seat assignments + connection
// bookkeeping + the current engine MatchState. This is the fast path for
// gameplay; server/persistence.ts mirrors every state change to Postgres so
// a server restart can rehydrate from the database (see rehydrate()).

import { MatchState, Seat, SEATS, TeamId, teamForSeat } from "@/engine/types";
import { ChatMessage } from "@/sockets/chatEvents";
import { MusicState } from "@/sockets/musicEvents";
import { MUSIC_LIBRARY } from "@/lib/musicLibrary";

const CHAT_HISTORY_LIMIT = 50;

function initialMusicState(): MusicState {
  return {
    trackId: null,
    status: "stopped",
    order: MUSIC_LIBRARY.map((t) => t.id),
    index: 0,
    shuffle: false,
    repeat: "off",
    positionMs: 0,
  };
}

export interface SeatOccupant {
  seat: Seat;
  team: TeamId;
  playerProfileId: string;
  displayName: string;
  avatarUrl?: string;
  connected: boolean;
  socketId?: string;
}

export type RoomStatus = "LOBBY" | "BIDDING" | "TRUMP_SELECT" | "PLAYING" | "HAND_COMPLETE" | "MATCH_COMPLETE";

export class GameSession {
  roomCode: string;
  roomId: string; // DB GameRoom.id
  hostPlayerProfileId: string;
  status: RoomStatus = "LOBBY";
  seats: Map<Seat, SeatOccupant> = new Map();
  match?: MatchState;
  matchDbId?: string;
  handDbId?: string;

  // --- Turn timer (card-play turns only, server-authoritative) ----------
  /** Epoch ms the active player's current play-turn expires, or undefined when no turn is in progress. */
  turnDeadline?: number;
  turnTimer?: NodeJS.Timeout;

  // --- Real-time communication state (ephemeral, not persisted) ---------
  chatHistory: ChatMessage[] = [];
  voiceReadySeats: Set<Seat> = new Set();
  mutedSeats: Set<Seat> = new Set();
  private emojiCounter = 0;

  // --- Synchronized room music (server-authoritative, ephemeral) --------
  music: MusicState = initialMusicState();
  musicTimer?: NodeJS.Timeout;

  // --- Coin economy ------------------------------------------------------
  /** Fixed tier amount in coins (see lib/coinEconomy.ts); 0 = no entry fee. */
  entryFee: number = 0;
  roomName?: string;
  isPrivate: boolean = true;
  /**
   * Re-entrancy lock for game:start — set synchronously before the first
   * await in the handler, so two rapid game:start emits from the same
   * client can't both pass the "!session.match" check before either
   * finishes awaiting the entry-fee deduction (which would double-charge
   * every player). Cleared in a finally block.
   */
  startingMatch: boolean = false;

  constructor(roomCode: string, roomId: string, hostPlayerProfileId: string, entryFee = 0, roomName?: string, isPrivate = true) {
    this.roomCode = roomCode;
    this.roomId = roomId;
    this.hostPlayerProfileId = hostPlayerProfileId;
    this.entryFee = entryFee;
    this.roomName = roomName;
    this.isPrivate = isPrivate;
  }

  get isFull(): boolean {
    return this.seats.size === 4;
  }

  seatFor(playerProfileId: string): SeatOccupant | undefined {
    for (const occupant of this.seats.values()) {
      if (occupant.playerProfileId === playerProfileId) return occupant;
    }
    return undefined;
  }

  seatForSocket(socketId: string): SeatOccupant | undefined {
    for (const occupant of this.seats.values()) {
      if (occupant.socketId === socketId) return occupant;
    }
    return undefined;
  }

  nextOpenSeat(): Seat | undefined {
    return SEATS.find((seat) => !this.seats.has(seat));
  }

  addOccupant(seat: Seat, playerProfileId: string, displayName: string, avatarUrl: string | undefined, socketId: string) {
    this.seats.set(seat, {
      seat,
      team: teamForSeat(seat),
      playerProfileId,
      displayName,
      avatarUrl,
      connected: true,
      socketId,
    });
  }

  addChatMessage(message: ChatMessage) {
    this.chatHistory.push(message);
    if (this.chatHistory.length > CHAT_HISTORY_LIMIT) {
      this.chatHistory.splice(0, this.chatHistory.length - CHAT_HISTORY_LIMIT);
    }
  }

  nextEmojiId(): number {
    this.emojiCounter += 1;
    return this.emojiCounter;
  }
}
