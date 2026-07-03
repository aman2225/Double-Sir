import { describe, expect, it } from "vitest";
import { isLegalPlay, legalPlays, resolveTrick } from "../trick";
import { Card, PlayedCard } from "../types";

const c = (rank: Card["rank"], suit: Card["suit"]): Card => ({ rank, suit });

describe("trick resolution", () => {
  it("must follow suit when able", () => {
    const hand: Card[] = [c("K", "HEARTS"), c("2", "HEARTS"), c("A", "SPADES")];
    const legal = legalPlays(hand, "HEARTS");
    expect(legal).toEqual([c("K", "HEARTS"), c("2", "HEARTS")]);
  });

  it("may play anything when unable to follow suit", () => {
    const hand: Card[] = [c("A", "SPADES"), c("K", "CLUBS")];
    const legal = legalPlays(hand, "HEARTS");
    expect(legal).toEqual(hand);
  });

  it("isLegalPlay rejects off-suit cards when following suit is possible", () => {
    const hand: Card[] = [c("K", "HEARTS"), c("A", "SPADES")];
    expect(isLegalPlay(hand, "HEARTS", c("A", "SPADES"))).toBe(false);
    expect(isLegalPlay(hand, "HEARTS", c("K", "HEARTS"))).toBe(true);
  });

  it("highest card of the lead suit wins when no trump is played", () => {
    const cards: PlayedCard[] = [
      { seat: 1, card: c("K", "HEARTS") },
      { seat: 2, card: c("2", "SPADES") },
      { seat: 3, card: c("A", "HEARTS") },
      { seat: 4, card: c("Q", "HEARTS") },
    ];
    expect(resolveTrick(cards, "HEARTS", "CLUBS")).toBe(3);
  });

  it("any trump beats every non-trump card, even a low trump vs a high off-suit card", () => {
    const cards: PlayedCard[] = [
      { seat: 1, card: c("A", "HEARTS") },
      { seat: 2, card: c("2", "CLUBS") }, // trump
      { seat: 3, card: c("K", "HEARTS") },
      { seat: 4, card: c("Q", "HEARTS") },
    ];
    expect(resolveTrick(cards, "HEARTS", "CLUBS")).toBe(2);
  });

  it("highest trump wins when multiple trumps are played", () => {
    const cards: PlayedCard[] = [
      { seat: 1, card: c("A", "HEARTS") },
      { seat: 2, card: c("2", "CLUBS") },
      { seat: 3, card: c("K", "CLUBS") },
      { seat: 4, card: c("Q", "HEARTS") },
    ];
    expect(resolveTrick(cards, "HEARTS", "CLUBS")).toBe(3);
  });
});
