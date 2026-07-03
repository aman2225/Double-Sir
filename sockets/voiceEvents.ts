// WebRTC signaling relay contract. Socket.IO carries ONLY offer/answer/ICE
// candidates and small status messages here — never audio itself, which
// flows peer-to-peer once a connection is established. Every payload
// addresses the other party by `seat`, never `socketId`: the server
// resolves `seat -> socketId` itself (see server/voiceHandlers.ts), so a
// client can never spoof which peer a signaling message reaches.

import { Seat } from "@/engine/types";

export interface VoiceRosterEntry {
  seat: Seat;
  playerProfileId: string;
  muted: boolean;
}

export interface VoiceClientEvents {
  /** Mic is ready (or the player wants to join the voice channel); requests the current roster. */
  "voice:ready": (payload: { roomCode: string }) => void;
  "voice:leave": (payload: { roomCode: string }) => void;
  "voice:offer": (payload: { roomCode: string; toSeat: Seat; sdp: string }) => void;
  "voice:answer": (payload: { roomCode: string; toSeat: Seat; sdp: string }) => void;
  "voice:ice-candidate": (payload: { roomCode: string; toSeat: Seat; candidate: string }) => void;
  "voice:mute-status": (payload: { roomCode: string; muted: boolean }) => void;
  /** Emitted only on speaking-state transitions (client-debounced), never per audio frame. */
  "voice:speaking": (payload: { roomCode: string; speaking: boolean }) => void;
}

export interface VoiceServerEvents {
  "voice:roster": (payload: { seats: VoiceRosterEntry[] }) => void;
  "voice:peer-joined": (payload: VoiceRosterEntry) => void;
  "voice:peer-left": (payload: { seat: Seat }) => void;
  "voice:offer": (payload: { fromSeat: Seat; sdp: string }) => void;
  "voice:answer": (payload: { fromSeat: Seat; sdp: string }) => void;
  "voice:ice-candidate": (payload: { fromSeat: Seat; candidate: string }) => void;
  "voice:mute-status": (payload: { seat: Seat; muted: boolean }) => void;
  "voice:speaking": (payload: { seat: Seat; speaking: boolean }) => void;
}
