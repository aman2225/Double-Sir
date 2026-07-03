import { describe, expect, it } from "vitest";
import { chooseAutoPlayCard } from "../autoPlay";
import type { Card } from "../types";

function card(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

describe("Turn timer — auto-play priority", () => {
  it("leading the trick (no leadSuit): plays the lowest card in hand overall", () => {
    const hand = [card("K", "SPADES"), card("4", "HEARTS"), card("9", "CLUBS")];
    expect(chooseAutoPlayCard(hand, undefined, "DIAMONDS")).toEqual(card("4", "HEARTS"));
  });

  it("priority 1 — able to follow suit: plays the lowest card of the lead suit", () => {
    const hand = [card("K", "HEARTS"), card("3", "HEARTS"), card("2", "SPADES")];
    expect(chooseAutoPlayCard(hand, "HEARTS", "CLUBS")).toEqual(card("3", "HEARTS"));
  });

  it("priority 2 — void in lead suit, holds non-trump: plays the lowest non-trump card", () => {
    const hand = [card("A", "SPADES"), card("5", "CLUBS"), card("2", "SPADES")];
    // Void in the lead suit (DIAMONDS) — legalPlays returns the whole hand;
    // trump is SPADES, so the lowest non-trump (CLUBS) card wins over any spade.
    expect(chooseAutoPlayCard(hand, "DIAMONDS", "SPADES")).toEqual(card("5", "CLUBS"));
  });

  it("priority 3 — void in lead suit, only trump remains: plays the lowest trump card", () => {
    const hand = [card("A", "SPADES"), card("2", "SPADES"), card("K", "SPADES")];
    expect(chooseAutoPlayCard(hand, "DIAMONDS", "SPADES")).toEqual(card("2", "SPADES"));
  });

  it("holding the lead suit as trump: still just follows suit (priority 1 applies before trump reasoning)", () => {
    const hand = [card("9", "SPADES"), card("2", "SPADES"), card("K", "HEARTS")];
    expect(chooseAutoPlayCard(hand, "SPADES", "SPADES")).toEqual(card("2", "SPADES"));
  });
});
