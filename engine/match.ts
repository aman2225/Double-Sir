// Hand/match lifecycle orchestration: starting a hand (shuffle + initial
// deal), and the match-level win condition.
//
// Two rules the spec leaves implicit, resolved here with a documented
// choice so behavior is deterministic:
//  1. Bidding order is always seat 1 -> 2 -> 3 -> 4 for every hand (the
//     spec states "Player 1 MUST bid" unconditionally, not "dealer's
//     left must bid"), so bidding order never rotates.
//  2. The player who wins the bid (and therefore chooses trump) leads the
//     first trick of the hand, since they set the contract everyone else
//     plays against. `dealerSeat` itself is cosmetic — it rotates each
//     hand purely to drive the "current dealer" UI indicator and has no
//     effect on bidding or play order.

import { initialBiddingState } from "./bidding";
import { buildDeck, dealInitial, shuffleDeck } from "./deck";
import { HandState, MATCH_LOSS_THRESHOLD, MatchState, SEATS, TeamId, initialStreakState, nextSeat } from "./types";

export function createMatch(roomId: string, targetPoints: number = MATCH_LOSS_THRESHOLD): MatchState {
  return {
    roomId,
    teamAPenalty: 0,
    teamBPenalty: 0,
    dealerSeat: 1,
    handNumber: 0,
    targetPoints,
    completedHands: [],
  };
}

export function startHand(match: MatchState, shuffleSeed: string): MatchState {
  const deck = shuffleDeck(buildDeck(), shuffleSeed);
  const { hands, undealt } = dealInitial(deck);

  const players = {} as HandState["players"];
  for (const seat of SEATS) {
    players[seat] = { seat, hand: hands[seat] };
  }

  const handState: HandState = {
    handNumber: match.handNumber + 1,
    dealerSeat: match.dealerSeat,
    shuffleSeed,
    phase: "BIDDING",
    players,
    undealt,
    bidding: initialBiddingState(),
    currentTrick: [],
    currentTurn: 1,
    tricksPlayed: [],
    streak: initialStreakState(),
  };

  return {
    ...match,
    handNumber: handState.handNumber,
    currentHand: handState,
  };
}

/** Rotates the cosmetic dealer seat and clears currentHand, ready for startHand() to be called again. */
export function prepareNextHand(match: MatchState): MatchState {
  return {
    ...match,
    dealerSeat: nextSeat(match.dealerSeat),
    currentHand: undefined,
  };
}

export function checkMatchComplete(match: MatchState): MatchState {
  if (match.winningTeam) return match;

  const threshold = match.targetPoints ?? MATCH_LOSS_THRESHOLD;
  const teamALost = match.teamAPenalty >= threshold;
  const teamBLost = match.teamBPenalty >= threshold;

  if (!teamALost && !teamBLost) return match;

  // If both cross the threshold in the same hand (only possible if a
  // penalty is ever applied to both teams at once, which this scoring
  // system never does, but guarded defensively), the team with the lower
  // penalty wins; a tie is resolved in favor of Team A having lost first
  // by evaluation order below, since penalties are applied to exactly one
  // team per hand in practice.
  const winningTeam: TeamId = teamALost ? "B" : "A";

  return { ...match, winningTeam };
}
