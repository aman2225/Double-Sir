import { describe, expect, it } from "vitest";
import { applyBid, initialBiddingState, validateBid } from "../bidding";

describe("bidding", () => {
  it("Player 1 cannot pass", () => {
    const state = initialBiddingState();
    const v = validateBid(state, 1, undefined);
    expect(v.valid).toBe(false);
  });

  it("Player 1's opening bid must be within 7-13", () => {
    const state = initialBiddingState();
    expect(validateBid(state, 1, 6).valid).toBe(false);
    expect(validateBid(state, 1, 14).valid).toBe(false);
    expect(validateBid(state, 1, 7).valid).toBe(true);
    expect(validateBid(state, 1, 13).valid).toBe(true);
  });

  it("spec example: P1=7, P2=Pass, P3=9, P4=Pass -> Player 3 wins", () => {
    let state = initialBiddingState();
    state = applyBid(state, 1, 7);
    expect(state.currentSeat).toBe(2);

    expect(validateBid(state, 2, undefined).valid).toBe(true); // pass is legal
    state = applyBid(state, 2, undefined);
    expect(state.currentSeat).toBe(3);

    // seat 3 may not bid <=7
    expect(validateBid(state, 3, 7).valid).toBe(false);
    expect(validateBid(state, 3, 9).valid).toBe(true);
    state = applyBid(state, 3, 9);
    expect(state.currentSeat).toBe(4);

    state = applyBid(state, 4, undefined);
    expect(state.phase).toBe("COMPLETE");
    expect(state.winningSeat).toBe(3);
    expect(state.highestBid).toEqual({ seat: 3, value: 9 });
  });

  it("rejects equal or lower bids from seats 2-4", () => {
    let state = initialBiddingState();
    state = applyBid(state, 1, 8);
    expect(validateBid(state, 2, 8).valid).toBe(false); // equal not allowed
    expect(validateBid(state, 2, 7).valid).toBe(false); // lower not allowed
    expect(validateBid(state, 2, 9).valid).toBe(true);
  });

  it("if everyone else passes, Player 1's forced bid wins", () => {
    let state = initialBiddingState();
    state = applyBid(state, 1, 7);
    state = applyBid(state, 2, undefined);
    state = applyBid(state, 3, undefined);
    state = applyBid(state, 4, undefined);
    expect(state.phase).toBe("COMPLETE");
    expect(state.winningSeat).toBe(1);
    expect(state.highestBid).toEqual({ seat: 1, value: 7 });
  });

  it("rejects acting out of turn", () => {
    const state = initialBiddingState();
    expect(validateBid(state, 2, 8).valid).toBe(false);
  });
});
