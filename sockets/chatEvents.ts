import { Seat } from "@/engine/types";

export interface ChatMessage {
  id: string;
  seat: Seat;
  playerProfileId: string;
  displayName: string;
  avatarUrl?: string;
  text: string;
  /** Epoch milliseconds. */
  sentAt: number;
}

export interface ChatClientEvents {
  "chat:send": (payload: { roomCode: string; text: string }) => void;
}

export interface ChatServerEvents {
  "chat:message": (message: ChatMessage) => void;
  /** Replayed to a socket right after it (re)joins a room, so a reconnecting player sees recent history immediately. */
  "chat:history": (payload: { messages: ChatMessage[] }) => void;
}
