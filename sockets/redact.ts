// Derives the wire-safe, per-viewer state sent to a socket from the
// authoritative engine MatchState. This is the ONLY place another player's
// hand is ever hidden — the engine itself always holds full information,
// and it is this function's job to make sure a card in another player's
// hand never reaches a client that shouldn't see it.

import { HandState, MatchState, SEATS, Seat } from "@/engine/types";
import { PublicHandState, PublicMatchState } from "./events";

function redactHand(hand: HandState, viewerSeat: Seat): PublicHandState {
  return {
    handNumber: hand.handNumber,
    dealerSeat: hand.dealerSeat,
    phase: hand.phase === "DEALING_INITIAL" || hand.phase === "DEALING_REMAINING" ? "BIDDING" : hand.phase,
    players: SEATS.map((seat) => ({
      seat,
      cardCount: hand.players[seat].hand.length,
      hand: seat === viewerSeat ? hand.players[seat].hand : undefined,
    })),
    bidding: {
      entries: hand.bidding.entries,
      currentSeat: hand.bidding.currentSeat,
      highestBid: hand.bidding.highestBid,
      phase: hand.bidding.phase,
    },
    trumpSuit: hand.trumpSuit,
    currentTrick: hand.currentTrick,
    leadSuit: hand.leadSuit,
    currentTurn: hand.currentTurn,
    tricksPlayedCount: hand.tricksPlayed.length,
    streak: hand.streak,
  };
}

export function redactMatchForSeat(match: MatchState, viewerSeat: Seat): PublicMatchState {
  return {
    roomCode: match.roomId,
    teamAPenalty: match.teamAPenalty,
    teamBPenalty: match.teamBPenalty,
    dealerSeat: match.dealerSeat,
    handNumber: match.handNumber,
    winningTeam: match.winningTeam,
    currentHand: match.currentHand ? redactHand(match.currentHand, viewerSeat) : undefined,
  };
}
