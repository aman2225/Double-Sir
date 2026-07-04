import { describe, expect, it } from "vitest";
import { applyAction, InvalidActionError } from "../reducer";
import { createMatch } from "../match";
import { legalPlays } from "../trick";
import { computeHandPenalty } from "../scoring";
import { EngineEvent, GameAction, MatchState, Seat, TRICKS_PER_HAND, teamForSeat } from "../types";

function dispatch(match: MatchState, action: GameAction) {
  const result = applyAction(match, action);
  return result;
}

/** Plays an entire hand to completion using a trivial "always play the first legal card" bot for every seat. */
function playFullHand(match: MatchState): { match: MatchState; events: EngineEvent[] } {
  const allEvents: EngineEvent[] = [];

  // Player 1 must bid; everyone else passes so bidding resolves quickly
  // and deterministically for the test.
  let r = dispatch(match, { type: "PLACE_BID", seat: 1, value: 7 });
  allEvents.push(...r.events);
  r = dispatch(r.state, { type: "PLACE_BID", seat: 2, value: undefined });
  allEvents.push(...r.events);
  r = dispatch(r.state, { type: "PLACE_BID", seat: 3, value: undefined });
  allEvents.push(...r.events);
  r = dispatch(r.state, { type: "PLACE_BID", seat: 4, value: undefined });
  allEvents.push(...r.events);

  expect(r.state.currentHand?.phase).toBe("TRUMP_SELECTION");
  expect(r.state.currentHand?.bidding.winningSeat).toBe(1);

  r = dispatch(r.state, { type: "SELECT_TRUMP", seat: 1, suit: "SPADES" });
  allEvents.push(...r.events);
  expect(r.state.currentHand?.phase).toBe("PLAYING");
  for (const seat of [1, 2, 3, 4] as const) {
    expect(r.state.currentHand?.players[seat].hand).toHaveLength(13);
  }

  // Play tricks until hand completes.
  for (let trick = 0; trick < TRICKS_PER_HAND; trick++) {
    if (r.state.currentHand?.phase === "COMPLETE") break;
    for (let i = 0; i < 4; i++) {
      const hand = r.state.currentHand!;
      if (hand.phase === "COMPLETE") break;
      const seat = hand.currentTurn;
      const playerHand = hand.players[seat].hand;
      const legal = legalPlays(playerHand, hand.leadSuit);
      const card = legal[0];
      r = dispatch(r.state, { type: "PLAY_CARD", seat, card });
      allEvents.push(...r.events);
    }
  }

  return { match: r.state, events: allEvents };
}

describe("reducer integration", () => {
  it("plays a full 13-trick hand end-to-end and keeps every invariant", () => {
    const match = createMatch("room-1");
    const started = dispatch(match, { type: "START_HAND", shuffleSeed: "integration-seed-1" });

    const { match: finalMatch, events } = playFullHand(started.state);

    const handCompleteEvent = events.find((e) => e.type === "HAND_COMPLETE");
    expect(handCompleteEvent).toBeDefined();
    if (handCompleteEvent?.type !== "HAND_COMPLETE") throw new Error("unreachable");

    // Hand completed cleanly (either via early break or after 13 tricks).
    expect(handCompleteEvent.teamAHands + handCompleteEvent.teamBHands).toBeLessThanOrEqual(13);

    // Penalty math must match the scoring module exactly for this outcome.
    const biddingTeamHands =
      handCompleteEvent.biddingTeam === "A" ? handCompleteEvent.teamAHands : handCompleteEvent.teamBHands;
    const expectedPenalty = computeHandPenalty(
      handCompleteEvent.biddingTeam,
      handCompleteEvent.declaredBid,
      biddingTeamHands
    );
    expect(handCompleteEvent.bidSuccess).toBe(expectedPenalty.bidSuccess);
    expect(handCompleteEvent.penaltyApplied).toBe(expectedPenalty.penaltyApplied);
    expect(handCompleteEvent.penaltyTeam).toBe(expectedPenalty.penaltyTeam);

    // Match totals reflect exactly one team being penalized this hand.
    if (expectedPenalty.penaltyTeam === "A") {
      expect(finalMatch.teamAPenalty).toBe(expectedPenalty.penaltyApplied);
      expect(finalMatch.teamBPenalty).toBe(0);
    } else {
      expect(finalMatch.teamBPenalty).toBe(expectedPenalty.penaltyApplied);
      expect(finalMatch.teamAPenalty).toBe(0);
    }

    expect(finalMatch.currentHand?.phase).toBe("COMPLETE");
    expect(finalMatch.completedHands).toHaveLength(1);
  });

  it("rejects a card play out of turn", () => {
    const match = createMatch("room-1");
    const started = dispatch(match, { type: "START_HAND", shuffleSeed: "seed-turn-order" });
    let r = dispatch(started.state, { type: "PLACE_BID", seat: 1, value: 7 });
    r = dispatch(r.state, { type: "PLACE_BID", seat: 2, value: undefined });
    r = dispatch(r.state, { type: "PLACE_BID", seat: 3, value: undefined });
    r = dispatch(r.state, { type: "PLACE_BID", seat: 4, value: undefined });
    r = dispatch(r.state, { type: "SELECT_TRUMP", seat: 1, suit: "HEARTS" });

    const hand = r.state.currentHand!;
    const wrongSeat = (hand.currentTurn % 4) + 1 as Seat; // guaranteed not the current turn
    const card = hand.players[wrongSeat].hand[0];
    expect(() => applyAction(r.state, { type: "PLAY_CARD", seat: wrongSeat, card })).toThrow(InvalidActionError);
  });

  it("rejects a bid from Team B's seat trying to select trump", () => {
    const match = createMatch("room-1");
    const started = dispatch(match, { type: "START_HAND", shuffleSeed: "seed-trump-guard" });
    let r = dispatch(started.state, { type: "PLACE_BID", seat: 1, value: 7 });
    r = dispatch(r.state, { type: "PLACE_BID", seat: 2, value: undefined });
    r = dispatch(r.state, { type: "PLACE_BID", seat: 3, value: undefined });
    r = dispatch(r.state, { type: "PLACE_BID", seat: 4, value: undefined });

    expect(() => applyAction(r.state, { type: "SELECT_TRUMP", seat: 2, suit: "CLUBS" })).toThrow(InvalidActionError);
  });

  it("rejects an equal or lower bid from seats 2-4", () => {
    const match = createMatch("room-1");
    const started = dispatch(match, { type: "START_HAND", shuffleSeed: "seed-bid-guard" });
    const r = dispatch(started.state, { type: "PLACE_BID", seat: 1, value: 8 });
    expect(() => applyAction(r.state, { type: "PLACE_BID", seat: 2, value: 8 })).toThrow(InvalidActionError);
    expect(() => applyAction(r.state, { type: "PLACE_BID", seat: 2, value: 7 })).toThrow(InvalidActionError);
  });

  it("teamForSeat matches the fixed partnership (1&3 = A, 2&4 = B)", () => {
    expect(teamForSeat(1)).toBe("A");
    expect(teamForSeat(3)).toBe("A");
    expect(teamForSeat(2)).toBe("B");
    expect(teamForSeat(4)).toBe("B");
  });
});
