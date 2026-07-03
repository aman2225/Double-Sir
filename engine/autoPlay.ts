// Auto-play policy for the server-authoritative turn timer: chooses the
// card a player's turn auto-plays when their 30s clock expires. Pure, no
// I/O — the server (server/turnTimer.ts) is the only caller.

import { Card, Suit, rankValue } from "./types";
import { legalPlays } from "./trick";

function lowest(cards: Card[]): Card {
  return [...cards].sort((a, b) => rankValue(a.rank) - rankValue(b.rank))[0];
}

/**
 * Priority: (1) lowest card following the lead suit, if able; (2) else
 * lowest non-trump card; (3) else lowest trump card. `legalPlays` already
 * encodes "follow suit if able, otherwise anything" — this just picks the
 * lowest-ranked card within that legal set per the priority above.
 */
export function chooseAutoPlayCard(hand: Card[], leadSuit: Suit | undefined, trumpSuit: Suit | undefined): Card {
  const legal = legalPlays(hand, leadSuit);

  if (leadSuit !== undefined) {
    const followers = legal.filter((c) => c.suit === leadSuit);
    if (followers.length > 0) return lowest(followers);
  }

  const nonTrump = legal.filter((c) => c.suit !== trumpSuit);
  if (nonTrump.length > 0) return lowest(nonTrump);

  return lowest(legal);
}
