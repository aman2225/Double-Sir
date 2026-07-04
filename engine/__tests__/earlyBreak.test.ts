import { describe, expect, it } from "vitest";
import { applyAction } from "../reducer";
import { createMatch } from "../match";
import { legalPlays } from "../trick";
import { GameAction, MatchState, Seat, StreakState } from "../types";

function dispatch(match: MatchState, action: GameAction) {
  return applyAction(match, action);
}

function setupPlayingHand(bidderSeat: Seat, declaredBid: number, initialStreak?: Partial<StreakState>): MatchState {
  const match = createMatch("room-early-break");
  let r = dispatch(match, { type: "START_HAND", shuffleSeed: "seed-early-break-test" });

  // Place bids: bidderSeat bids declaredBid, others pass
  for (const s of [1, 2, 3, 4] as Seat[]) {
    if (s === bidderSeat) {
      r = dispatch(r.state, { type: "PLACE_BID", seat: s, value: declaredBid });
    } else {
      r = dispatch(r.state, { type: "PLACE_BID", seat: s, value: undefined });
    }
  }

  r = dispatch(r.state, { type: "SELECT_TRUMP", seat: bidderSeat, suit: "SPADES" });

  if (initialStreak && r.state.currentHand) {
    r = {
      ...r,
      state: {
        ...r.state,
        currentHand: {
          ...r.state.currentHand,
          streak: {
            ...r.state.currentHand.streak,
            ...initialStreak,
          },
        },
      },
    };
  }

  return r.state;
}

/** Plays 1 trick ensuring legal plays for each seat. */
function playLegalTrick(matchState: MatchState): MatchState {
  let rState = matchState;
  for (let i = 0; i < 4; i++) {
    const hand = rState.currentHand;
    if (!hand || hand.phase === "COMPLETE") break;
    const turn = hand.currentTurn;
    const playerHand = hand.players[turn].hand;
    const legal = legalPlays(playerHand, hand.leadSuit);
    const card = legal[0];
    const res = dispatch(rState, { type: "PLAY_CARD", seat: turn, card });
    rState = res.state;
  }
  return rState;
}

describe("Early Game Termination (Break Condition)", () => {
  it("triggers Early Success immediately when bidder team reaches declared bid", () => {
    // Bidder Seat 1 (Team A) bids 7
    // Set streak state as if Team A has 6 hands and Seat 1 is on an established streak
    let state = setupPlayingHand(1, 7, {
      teamAHands: 6,
      teamBHands: 0,
      currentStreakPlayer: 1,
      currentStreakCount: 2,
      streakEstablished: true,
      unclaimedHands: 0,
    });

    // Play 1 trick using legal plays
    state = playLegalTrick(state);

    // After trick completes, Seat 1 won trick or forced collection -> Team A reached 7 hands.
    // Hand should complete with Early Success.
    const hand = state.currentHand!;
    expect(hand.phase).toBe("COMPLETE");
    expect(hand.earlyBreak).toBe(true);
    expect(hand.bidSuccess).toBe(true);
    expect(hand.earlyBreakReason).toContain("Team A successfully completed the bid of 7 hands");
    expect(state.teamBPenalty).toBe(7); // Opposing team penalty += declaredBid
    expect(state.teamAPenalty).toBe(0);
  });

  it("triggers Early Failure when bidder team cannot mathematically reach declared bid", () => {
    // Bidder Seat 1 (Team A) bids 10
    // Set streak state: Team A = 2 hands, Team B = 4 hands
    // Max possible for Team A = 13 - 4 = 9 < 10
    let state = setupPlayingHand(1, 10, {
      teamAHands: 2,
      teamBHands: 4,
    });

    state = playLegalTrick(state);

    const hand = state.currentHand!;
    expect(hand.phase).toBe("COMPLETE");
    expect(hand.earlyBreak).toBe(true);
    expect(hand.bidSuccess).toBe(false);
    expect(hand.earlyBreakReason).toContain("Team A can no longer mathematically achieve the declared bid of 10 hands");
    expect(state.teamAPenalty).toBe(20); // Bidding team penalty += 2 * 10
  });

  it("triggers Opponent Break Condition when opponents reach enough hands to defeat the bid", () => {
    // Bidder Seat 1 (Team A) bids 8
    // Opponent Team B has 6 hands. Max possible for Team A = 13 - 6 = 7 < 8
    let state = setupPlayingHand(1, 8, {
      teamAHands: 3,
      teamBHands: 6,
    });

    state = playLegalTrick(state);

    const hand = state.currentHand!;
    expect(hand.phase).toBe("COMPLETE");
    expect(hand.earlyBreak).toBe(true);
    expect(hand.bidSuccess).toBe(false);
    expect(hand.penaltyTeam).toBe("A");
    expect(hand.penaltyApplied).toBe(16); // 2 * 8
  });
});
