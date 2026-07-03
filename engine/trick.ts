// Trick-taking rules: follow suit if able, trump beats every non-trump
// suit, highest rank of the winning suit wins.

import { Card, PlayedCard, Seat, Suit, rankValue } from "./types";

/** Cards a player is allowed to play, given the leading suit (undefined if they are leading). */
export function legalPlays(hand: Card[], leadSuit: Suit | undefined): Card[] {
  if (leadSuit === undefined) {
    return hand;
  }
  const followSuit = hand.filter((c) => c.suit === leadSuit);
  return followSuit.length > 0 ? followSuit : hand;
}

export function isLegalPlay(hand: Card[], leadSuit: Suit | undefined, card: Card): boolean {
  return legalPlays(hand, leadSuit).some((c) => c.suit === card.suit && c.rank === card.rank);
}

/**
 * Resolves a completed trick (4 played cards) to the winning seat.
 * Trump beats every non-trump card regardless of rank; among cards of the
 * winning suit (trump if any trump was played, otherwise the lead suit),
 * the highest rank wins.
 */
export function resolveTrick(cards: PlayedCard[], leadSuit: Suit, trumpSuit: Suit): Seat {
  const trumpPlays = cards.filter((c) => c.card.suit === trumpSuit);
  const contestPool = trumpPlays.length > 0 ? trumpPlays : cards.filter((c) => c.card.suit === leadSuit);

  let winner = contestPool[0];
  for (const play of contestPool.slice(1)) {
    if (rankValue(play.card.rank) > rankValue(winner.card.rank)) {
      winner = play;
    }
  }
  return winner.seat;
}
