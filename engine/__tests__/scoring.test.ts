import { describe, expect, it } from "vitest";
import { applyPenaltyToMatch, computeHandPenalty } from "../scoring";

describe("scoring", () => {
  it("spec example: Team A bids 7, captures >=7 -> Team B gets +7, Team A 0", () => {
    const result = computeHandPenalty("A", 7, 7);
    expect(result).toEqual({ bidSuccess: true, penaltyApplied: 7, penaltyTeam: "B" });
  });

  it("spec example: Team B bids 9, captures 10 -> Team A gets +9 (no bonus for exceeding bid)", () => {
    const result = computeHandPenalty("B", 9, 10);
    expect(result).toEqual({ bidSuccess: true, penaltyApplied: 9, penaltyTeam: "A" });
  });

  it("spec example: Team A bids 7, captures only 6 -> Team A gets +14 (2x), Team B 0", () => {
    const result = computeHandPenalty("A", 7, 6);
    expect(result).toEqual({ bidSuccess: false, penaltyApplied: 14, penaltyTeam: "A" });
  });

  it("spec example: Team A bids 10, captures only 8 -> Team A gets +20", () => {
    const result = computeHandPenalty("A", 10, 8);
    expect(result).toEqual({ bidSuccess: false, penaltyApplied: 20, penaltyTeam: "A" });
  });

  it("applyPenaltyToMatch accumulates onto the correct team's running total", () => {
    let totals = { teamAPenalty: 5, teamBPenalty: 3 };
    totals = applyPenaltyToMatch(totals, { bidSuccess: false, penaltyApplied: 14, penaltyTeam: "A" });
    expect(totals).toEqual({ teamAPenalty: 19, teamBPenalty: 3 });
  });
});
