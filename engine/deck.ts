import { Card, RANK_ORDER, SUITS, SUIT_ORDER, Seat, SEATS, rankValue } from "./types";

/** Sorts cards by suit first (Spades, Hearts, Diamonds, Clubs), then by rank descending (A down to 2). */
export function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    if (a.suit !== b.suit) {
      return SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
    }
    return rankValue(b.rank) - rankValue(a.rank);
  });
}

/** Builds an ordered standard 52-card deck (unshuffled). */
export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANK_ORDER) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

/**
 * Mulberry32 — small, fast, deterministic PRNG. Given the same numeric seed
 * it always produces the same sequence, which lets us store a seed per hand
 * (Hand.shuffleSeed) and reconstruct/audit the exact deal later.
 */
function mulberry32(seed: number) {
  let a = seed;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedToNumber(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (Math.imul(31, hash) + seed.charCodeAt(i)) | 0;
  }
  return hash;
}

/** Fisher-Yates shuffle driven by a seeded RNG so hands are reproducible. */
export function shuffleDeck(deck: Card[], shuffleSeed: string): Card[] {
  const rng = mulberry32(seedToNumber(shuffleSeed));
  const result = [...deck];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export interface InitialDeal {
  hands: Record<Seat, Card[]>;
  undealt: Card[];
}

/** Step 2: deals exactly 5 cards to each player; the remaining 8 per player stay undealt. */
export function dealInitial(shuffledDeck: Card[]): InitialDeal {
  const hands = {} as Record<Seat, Card[]>;
  for (const seat of SEATS) hands[seat] = [];

  let cursor = 0;
  for (const seat of SEATS) {
    hands[seat] = sortCards(shuffledDeck.slice(cursor, cursor + 5));
    cursor += 5;
  }
  const undealt = shuffledDeck.slice(cursor);
  return { hands, undealt };
}

/**
 * Step 5: deals the remaining 8 cards per player once trump is locked in.
 * `undealt` is assumed to be the 32 cards left over from dealInitial, in the
 * same shuffled order, so each player receives a contiguous block of 8.
 */
export function dealRemaining(undealt: Card[]): Record<Seat, Card[]> {
  const result = {} as Record<Seat, Card[]>;
  let cursor = 0;
  for (const seat of SEATS) {
    result[seat] = undealt.slice(cursor, cursor + 8);
    cursor += 8;
  }
  return result;
}
