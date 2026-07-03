// Penalty-based scoring. Both teams start each match at 0 penalty points;
// the objective is to avoid accumulating them. Only the highest bidder's
// declared bid matters — capturing more hands than declared grants no
// bonus, and only one team is penalized per hand.
//
//   Bid succeeds (biddingTeamHands >= declaredBid):
//     opposing team penalty += declaredBid
//   Bid fails (biddingTeamHands < declaredBid):
//     bidding team penalty += 2 * declaredBid

import { TeamId } from "./types";

export interface PenaltyResult {
  bidSuccess: boolean;
  penaltyApplied: number;
  penaltyTeam: TeamId;
}

function opposingTeam(team: TeamId): TeamId {
  return team === "A" ? "B" : "A";
}

export function computeHandPenalty(
  biddingTeam: TeamId,
  declaredBid: number,
  biddingTeamHands: number
): PenaltyResult {
  const bidSuccess = biddingTeamHands >= declaredBid;

  if (bidSuccess) {
    return { bidSuccess: true, penaltyApplied: declaredBid, penaltyTeam: opposingTeam(biddingTeam) };
  }

  return { bidSuccess: false, penaltyApplied: declaredBid * 2, penaltyTeam: biddingTeam };
}

export interface MatchPenaltyTotals {
  teamAPenalty: number;
  teamBPenalty: number;
}

export function applyPenaltyToMatch(totals: MatchPenaltyTotals, result: PenaltyResult): MatchPenaltyTotals {
  if (result.penaltyTeam === "A") {
    return { teamAPenalty: totals.teamAPenalty + result.penaltyApplied, teamBPenalty: totals.teamBPenalty };
  }
  return { teamAPenalty: totals.teamAPenalty, teamBPenalty: totals.teamBPenalty + result.penaltyApplied };
}
