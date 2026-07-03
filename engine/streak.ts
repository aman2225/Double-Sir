// "Double Sir" — the custom trick-capture mechanic that replaces
// traditional trick-taking scoring.
//
// A trick is never awarded the instant it's won. Every completed trick
// first enters a shared "unclaimed" pool. Consecutive wins are tracked PER
// PLAYER (never per team — a teammate winning the next trick does not
// continue another teammate's streak). If a different player wins before a
// streak reaches two, the previous player's streak is completely lost and
// the new winner starts a fresh streak of one; the trick they just won
// joins the (still-growing) unclaimed pool.
//
// The moment a player reaches TWO CONSECUTIVE wins, they immediately claim
// every trick currently sitting in the unclaimed pool — not just the two
// that completed the streak. From that point on their streak is
// "established": as long as they keep winning uninterrupted, each new
// trick is captured the instant it's won (the pool never has a chance to
// grow again while their streak holds), because the streak requirement has
// already been satisfied once. Losing a trick to any other player fully
// resets this — the streak (and its established status) is lost, and the
// next winner starts over.
//
// Special case for trick 13 (the last trick of the hand): if it resolves
// without a streak being established (or already active) on that very
// trick, there is no trick 14 to let a fresh streak continue, so its
// winner's team automatically collects whatever remains in the unclaimed
// pool. This guarantees teamAHands + teamBHands === 13 after every hand,
// which callers must treat as an invariant (see assertHandInvariant below).

import { Seat, StreakState, TeamId, TRICKS_PER_HAND, teamForSeat } from "./types";

export interface StreakUpdateResult {
  streak: StreakState;
  /** Present only on the trick where a team actually captures one or more tricks. */
  handsCollected?: { team: TeamId; count: number };
}

export function recordTrickWin(state: StreakState, winner: Seat, trickNumber: number): StreakUpdateResult {
  const isFinalTrick = trickNumber === TRICKS_PER_HAND;
  const isContinuingStreak = state.currentStreakPlayer === winner;

  if (isContinuingStreak && state.streakEstablished) {
    // Hot streak already active: this single trick is captured the instant
    // it's won — no need to wait for another fresh pair.
    const team = teamForSeat(winner);
    const teamAHands = state.teamAHands + (team === "A" ? 1 : 0);
    const teamBHands = state.teamBHands + (team === "B" ? 1 : 0);

    return {
      streak: {
        unclaimedHands: 0,
        currentStreakPlayer: winner,
        currentStreakCount: state.currentStreakCount + 1,
        streakEstablished: true,
        teamAHands,
        teamBHands,
      },
      handsCollected: { team, count: 1 },
    };
  }

  // Either a different player won, or the same player is winning but
  // hasn't reached a fresh streak of two yet — either way this trick joins
  // (or restarts) the unclaimed pool.
  const unclaimedHands = state.unclaimedHands + 1;
  const currentStreakCount = isContinuingStreak ? state.currentStreakCount + 1 : 1;
  const currentStreakPlayer = winner;
  const justEstablished = currentStreakCount === 2;

  // Forced end-of-hand cleanup: trick 13 resolved without establishing (or
  // continuing) a streak this trick, so there is no trick 14 to carry the
  // pool forward — the winner's team takes everything left unclaimed.
  const forcedCollection = isFinalTrick && !justEstablished;

  if (justEstablished || forcedCollection) {
    const team = teamForSeat(winner);
    const teamAHands = state.teamAHands + (team === "A" ? unclaimedHands : 0);
    const teamBHands = state.teamBHands + (team === "B" ? unclaimedHands : 0);

    return {
      streak: {
        unclaimedHands: 0,
        currentStreakPlayer,
        currentStreakCount,
        // A forced trick-13 collection does not require the player to have
        // actually reached two in a row (see Notes: "documented rule" for
        // the edge case) — only mark the streak established when they
        // genuinely earned it.
        streakEstablished: justEstablished,
        teamAHands,
        teamBHands,
      },
      handsCollected: { team, count: unclaimedHands },
    };
  }

  return {
    streak: {
      unclaimedHands,
      currentStreakPlayer,
      currentStreakCount,
      streakEstablished: false,
      teamAHands: state.teamAHands,
      teamBHands: state.teamBHands,
    },
  };
}

/**
 * Defensive invariant: after all 13 tricks are resolved, every hand must
 * always be assigned to exactly one team. Throws if violated — this should
 * be unreachable given recordTrickWin's forced trick-13 collection.
 */
export function assertHandInvariant(state: StreakState): void {
  const total = state.teamAHands + state.teamBHands;
  if (total !== TRICKS_PER_HAND) {
    throw new Error(
      `Hand collection invariant violated: teamAHands (${state.teamAHands}) + teamBHands (${state.teamBHands}) = ${total}, expected ${TRICKS_PER_HAND}.`
    );
  }
}
