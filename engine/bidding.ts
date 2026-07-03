// Bidding phase state machine.
//
// Bidding is a single pass through the fixed order Player 1 -> 2 -> 3 -> 4:
// each seat acts exactly once, then bidding ends.
//   Player 1 → 7
//   Player 2 → Pass
//   Player 3 → 9
//   Player 4 → Pass
//   Winner: Player 3
// Player 1 MUST bid (7-13, no pass). Players 2-4 may pass, or bid strictly
// higher than the current highest bid (equal/lower bids are rejected).
// The winner is whoever holds the highest bid once all four seats have acted.

import { BiddingState, BidEntry, MAX_BID, MIN_OPENING_BID, Seat, nextSeat } from "./types";

export function initialBiddingState(): BiddingState {
  return {
    phase: "AWAITING_PLAYER1",
    entries: [],
    currentSeat: 1,
    highestBid: undefined,
    passedSeats: [],
    winningSeat: undefined,
  };
}

export interface BidValidation {
  valid: boolean;
  reason?: string;
}

/** Validates a proposed bid/pass without mutating state. */
export function validateBid(state: BiddingState, seat: Seat, value: number | undefined): BidValidation {
  if (state.phase === "COMPLETE") {
    return { valid: false, reason: "Bidding has already ended." };
  }
  if (state.currentSeat !== seat) {
    return { valid: false, reason: `It is seat ${state.currentSeat}'s turn to bid, not seat ${seat}.` };
  }

  if (seat === 1) {
    if (value === undefined) {
      return { valid: false, reason: "Player 1 must bid and cannot pass." };
    }
    if (value < MIN_OPENING_BID || value > MAX_BID) {
      return { valid: false, reason: `Player 1's opening bid must be between ${MIN_OPENING_BID} and ${MAX_BID}.` };
    }
    return { valid: true };
  }

  // Seats 2-4: pass is always legal.
  if (value === undefined) {
    return { valid: true };
  }

  if (value > MAX_BID) {
    return { valid: false, reason: `Bids cannot exceed ${MAX_BID}.` };
  }

  const highest = state.highestBid?.value ?? 0;
  if (value <= highest) {
    return { valid: false, reason: `Bid must be strictly higher than the current highest bid (${highest}).` };
  }

  return { valid: true };
}

/**
 * Applies a validated bid/pass and returns the next bidding state. Callers
 * (engine/reducer.ts) must call validateBid first and reject invalid
 * actions before ever reaching this function.
 *
 * Each of the four seats acts exactly once, strictly in seat order
 * (1 -> 2 -> 3 -> 4); after seat 4 acts, bidding is complete and the seat
 * holding the highest bid (Player 1's forced bid, at minimum) wins.
 */
export function applyBid(state: BiddingState, seat: Seat, value: number | undefined): BiddingState {
  const sequence = state.entries.length + 1;
  const entry: BidEntry = { seat, sequence, value };
  const entries = [...state.entries, entry];

  const passedSeats = value === undefined ? [...state.passedSeats, seat] : state.passedSeats;
  const highestBid = value !== undefined ? { seat, value } : state.highestBid;

  if (seat === 4) {
    // Final seat has acted — bidding is over. highestBid is guaranteed to
    // be set because Player 1 is never allowed to pass.
    return {
      phase: "COMPLETE",
      entries,
      currentSeat: seat,
      highestBid,
      passedSeats,
      winningSeat: highestBid!.seat,
    };
  }

  return {
    phase: "IN_PROGRESS",
    entries,
    currentSeat: nextSeat(seat),
    highestBid,
    passedSeats,
    winningSeat: undefined,
  };
}
