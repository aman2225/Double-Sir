import { describe, expect, it } from "vitest";
import { checkMatchComplete, createMatch, prepareNextHand, startHand } from "../match";

describe("match lifecycle", () => {
  it("createMatch starts both teams at 0 penalty with dealer seat 1", () => {
    const match = createMatch("room-1");
    expect(match.teamAPenalty).toBe(0);
    expect(match.teamBPenalty).toBe(0);
    expect(match.dealerSeat).toBe(1);
    expect(match.handNumber).toBe(0);
  });

  it("startHand deals 5 cards to each seat and puts the hand into BIDDING", () => {
    const match = createMatch("room-1");
    const next = startHand(match, "seed-1");
    expect(next.currentHand?.phase).toBe("BIDDING");
    expect(next.handNumber).toBe(1);
    for (const seat of [1, 2, 3, 4] as const) {
      expect(next.currentHand?.players[seat].hand).toHaveLength(5);
    }
    expect(next.currentHand?.undealt).toHaveLength(32);
  });

  it("prepareNextHand rotates the cosmetic dealer seat and clears currentHand", () => {
    const match = createMatch("room-1");
    const next = prepareNextHand(match);
    expect(next.dealerSeat).toBe(2);
    expect(next.currentHand).toBeUndefined();
  });

  it("match ends the instant a team reaches 53+ penalty; the OTHER team wins", () => {
    const match = createMatch("room-1");
    const lost = { ...match, teamAPenalty: 53, teamBPenalty: 10 };
    const result = checkMatchComplete(lost);
    expect(result.winningTeam).toBe("B");
  });

  it("match continues below the threshold", () => {
    const match = createMatch("room-1");
    const ongoing = { ...match, teamAPenalty: 52, teamBPenalty: 52 };
    const result = checkMatchComplete(ongoing);
    expect(result.winningTeam).toBeUndefined();
  });

  it("does not overwrite an already-decided winner", () => {
    const match = createMatch("room-1");
    const decided = { ...match, teamAPenalty: 60, teamBPenalty: 0, winningTeam: "B" as const };
    const result = checkMatchComplete(decided);
    expect(result.winningTeam).toBe("B");
  });
});
