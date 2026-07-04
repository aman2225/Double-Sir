import { describe, expect, it } from "vitest";
import { buildDeck, dealInitial, dealRemaining, shuffleDeck, sortCards } from "../deck";
import { Card, cardId } from "../types";

describe("deck", () => {
  it("builds a standard 52-card deck with no duplicates", () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map(cardId)).size).toBe(52);
  });

  it("shuffle is deterministic for a given seed and a permutation of the deck", () => {
    const deck = buildDeck();
    const a = shuffleDeck(deck, "seed-123");
    const b = shuffleDeck(deck, "seed-123");
    expect(a).toEqual(b);
    expect(new Set(a.map(cardId)).size).toBe(52);
  });

  it("different seeds produce different orderings", () => {
    const deck = buildDeck();
    const a = shuffleDeck(deck, "seed-A");
    const b = shuffleDeck(deck, "seed-B");
    expect(a).not.toEqual(b);
  });

  it("dealInitial gives each of 4 players exactly 5 cards, 32 remain undealt", () => {
    const deck = shuffleDeck(buildDeck(), "seed-x");
    const { hands, undealt } = dealInitial(deck);
    for (const seat of [1, 2, 3, 4] as const) {
      expect(hands[seat]).toHaveLength(5);
    }
    expect(undealt).toHaveLength(32);

    const allDealt = [...hands[1], ...hands[2], ...hands[3], ...hands[4], ...undealt];
    expect(new Set(allDealt.map(cardId)).size).toBe(52);
  });

  it("dealRemaining gives each player exactly 8 more cards, exhausting the undealt pile", () => {
    const deck = shuffleDeck(buildDeck(), "seed-y");
    const { undealt } = dealInitial(deck);
    const rest = dealRemaining(undealt);
    for (const seat of [1, 2, 3, 4] as const) {
      expect(rest[seat]).toHaveLength(8);
    }
    const allRest = [...rest[1], ...rest[2], ...rest[3], ...rest[4]];
    expect(allRest).toHaveLength(32);
    expect(new Set(allRest.map(cardId)).size).toBe(32);
  });

  it("sortCards sorts cards by suit order (Spades, Hearts, Diamonds, Clubs) and rank descending (A -> 2)", () => {
    const unsorted: Card[] = [
      { suit: "CLUBS", rank: "4" },
      { suit: "DIAMONDS", rank: "A" },
      { suit: "SPADES", rank: "7" },
      { suit: "HEARTS", rank: "K" },
      { suit: "SPADES", rank: "A" },
      { suit: "CLUBS", rank: "J" },
      { suit: "HEARTS", rank: "3" },
      { suit: "DIAMONDS", rank: "10" },
    ];
    const sorted = sortCards(unsorted);
    expect(sorted).toEqual([
      { suit: "SPADES", rank: "A" },
      { suit: "SPADES", rank: "7" },
      { suit: "HEARTS", rank: "K" },
      { suit: "HEARTS", rank: "3" },
      { suit: "DIAMONDS", rank: "A" },
      { suit: "DIAMONDS", rank: "10" },
      { suit: "CLUBS", rank: "J" },
      { suit: "CLUBS", rank: "4" },
    ]);
  });
});
