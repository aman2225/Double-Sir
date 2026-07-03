// Core types for the pure game engine. Nothing in this file (or anywhere
// under engine/) may import React, Next.js, Socket.IO, or Prisma — the
// engine must be usable from a unit test, a future AI player, or a replay
// tool with zero I/O dependencies.

export type Suit = "SPADES" | "HEARTS" | "DIAMONDS" | "CLUBS";

// Rank ordering low -> high. Ace is high, as is standard for trick-taking.
export type Rank = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";

export const RANK_ORDER: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
export const SUITS: Suit[] = ["SPADES", "HEARTS", "DIAMONDS", "CLUBS"];

export interface Card {
  suit: Suit;
  rank: Rank;
}

/** Stable string id for a card, e.g. "A-SPADES", useful for Set membership / React keys. */
export function cardId(card: Card): string {
  return `${card.rank}-${card.suit}`;
}

export function rankValue(rank: Rank): number {
  return RANK_ORDER.indexOf(rank);
}

// Seats are fixed 1-4 for the lifetime of a room.
export type Seat = 1 | 2 | 3 | 4;
export const SEATS: Seat[] = [1, 2, 3, 4];

// Teams are fixed by seat: Team A = {1, 3} (Player 1 & Player 3), Team B = {2, 4}.
export type TeamId = "A" | "B";

export function teamForSeat(seat: Seat): TeamId {
  return seat === 1 || seat === 3 ? "A" : "B";
}

export function nextSeat(seat: Seat): Seat {
  return ((seat % 4) + 1) as Seat;
}

export function partnerSeat(seat: Seat): Seat {
  return ((seat + 2 - 1) % 4 + 1) as Seat;
}

export const MIN_OPENING_BID = 7;
export const MAX_BID = 13;
export const TRICKS_PER_HAND = 13;
export const MATCH_LOSS_THRESHOLD = 53;

// --- Bidding -----------------------------------------------------------

export interface BidEntry {
  seat: Seat;
  sequence: number;
  /** undefined = PASS */
  value?: number;
}

export type BiddingPhase = "AWAITING_PLAYER1" | "IN_PROGRESS" | "COMPLETE";

export interface BiddingState {
  phase: BiddingPhase;
  entries: BidEntry[];
  currentSeat: Seat;
  highestBid?: { seat: Seat; value: number };
  /** Seats that have passed and are out of the bidding round. */
  passedSeats: Seat[];
  winningSeat?: Seat;
}

// --- Trick play ----------------------------------------------------------

export interface PlayedCard {
  seat: Seat;
  card: Card;
}

export interface TrickResult {
  trickNumber: number;
  leadSuit: Suit;
  cards: PlayedCard[];
  winningSeat: Seat;
}

// --- Consecutive win streak / trick capture (the "Double Sir" core mechanic) -

export interface StreakState {
  unclaimedHands: number;
  currentStreakPlayer: Seat | null;
  currentStreakCount: number;
  /**
   * True once currentStreakPlayer has reached two consecutive wins. While
   * true, every further consecutive win by that same player is captured
   * immediately (a "hot streak") rather than waiting to accumulate another
   * fresh pair. Reset to false the moment a different player wins a trick.
   */
  streakEstablished: boolean;
  teamAHands: number;
  teamBHands: number;
}

export function initialStreakState(): StreakState {
  return {
    unclaimedHands: 0,
    currentStreakPlayer: null,
    currentStreakCount: 0,
    streakEstablished: false,
    teamAHands: 0,
    teamBHands: 0,
  };
}

// --- Hand / Match lifecycle ----------------------------------------------

export type HandPhase =
  | "DEALING_INITIAL"
  | "BIDDING"
  | "TRUMP_SELECTION"
  | "DEALING_REMAINING"
  | "PLAYING"
  | "COMPLETE";

export interface PlayerHandState {
  seat: Seat;
  /** Cards currently held (revealed only to that player at the transport layer). */
  hand: Card[];
}

export interface HandState {
  handNumber: number;
  dealerSeat: Seat;
  shuffleSeed: string;
  phase: HandPhase;
  players: Record<Seat, PlayerHandState>;
  /** Cards not yet dealt (the 8 held back until trump is chosen). */
  undealt: Card[];
  bidding: BiddingState;
  trumpSuit?: Suit;
  currentTrick: PlayedCard[];
  leadSuit?: Suit;
  currentTurn: Seat;
  tricksPlayed: TrickResult[];
  streak: StreakState;
  bidSuccess?: boolean;
  penaltyApplied?: number;
  penaltyTeam?: TeamId;
}

export interface MatchState {
  roomId: string;
  teamAPenalty: number;
  teamBPenalty: number;
  dealerSeat: Seat;
  handNumber: number;
  winningTeam?: TeamId;
  currentHand?: HandState;
  completedHands: HandState[];
}

// --- Actions ---------------------------------------------------------------
// The single vocabulary of intents the reducer accepts. Every one of these
// must be validated against current state before being applied — see
// engine/reducer.ts.

export type GameAction =
  | { type: "START_HAND"; shuffleSeed: string }
  | { type: "PLACE_BID"; seat: Seat; value?: number }
  | { type: "SELECT_TRUMP"; seat: Seat; suit: Suit }
  | { type: "PLAY_CARD"; seat: Seat; card: Card };

export interface ActionResult {
  state: MatchState;
  events: EngineEvent[];
}

export type EngineEvent =
  | { type: "HAND_STARTED"; handNumber: number; dealerSeat: Seat }
  | { type: "BID_PLACED"; entry: BidEntry }
  | { type: "BIDDING_COMPLETE"; winningSeat: Seat; value: number }
  | { type: "TRUMP_SELECTED"; suit: Suit }
  | { type: "REMAINING_DEALT" }
  | { type: "CARD_PLAYED"; seat: Seat; card: Card }
  | {
      type: "TRICK_RESOLVED";
      trick: TrickResult;
      streak: StreakState;
      handsCollected?: { team: TeamId; count: number };
    }
  | {
      type: "HAND_COMPLETE";
      bidderSeat: Seat;
      declaredBid: number;
      biddingTeam: TeamId;
      bidSuccess: boolean;
      penaltyApplied: number;
      penaltyTeam: TeamId;
      teamAHands: number;
      teamBHands: number;
    }
  | { type: "MATCH_COMPLETE"; winningTeam: TeamId; teamAPenalty: number; teamBPenalty: number };
