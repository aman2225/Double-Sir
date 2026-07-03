// Single pure entry point for every game action. server/socketHandlers.ts
// is the ONLY caller of this in the running app; React components never
// import from engine/ directly. Because this is pure (state in, state +
// events out), the exact same function can back a unit test, a future AI
// player, or a replay tool.

import { applyBid, validateBid } from "./bidding";
import { dealRemaining } from "./deck";
import { computeHandPenalty } from "./scoring";
import { assertHandInvariant, recordTrickWin } from "./streak";
import { isLegalPlay, resolveTrick } from "./trick";
import { checkMatchComplete, startHand as startHandState } from "./match";
import {
  ActionResult,
  Card,
  EngineEvent,
  GameAction,
  HandState,
  MatchState,
  PlayedCard,
  Seat,
  Suit,
  TRICKS_PER_HAND,
  cardId,
  nextSeat,
  teamForSeat,
} from "./types";

export class InvalidActionError extends Error {}

function fail(reason: string): never {
  throw new InvalidActionError(reason);
}

export function applyAction(match: MatchState, action: GameAction): ActionResult {
  switch (action.type) {
    case "START_HAND":
      return handleStartHand(match, action.shuffleSeed);
    case "PLACE_BID":
      return handlePlaceBid(match, action.seat, action.value);
    case "SELECT_TRUMP":
      return handleSelectTrump(match, action.seat, action.suit);
    case "PLAY_CARD":
      return handlePlayCard(match, action.seat, action.card);
  }
}

function handleStartHand(match: MatchState, shuffleSeed: string): ActionResult {
  if (match.winningTeam) fail("Match has already ended.");
  if (match.currentHand && match.currentHand.phase !== "COMPLETE") {
    fail("Current hand has not finished yet.");
  }

  const next = startHandState(match, shuffleSeed);
  const hand = next.currentHand!;
  return {
    state: next,
    events: [{ type: "HAND_STARTED", handNumber: hand.handNumber, dealerSeat: hand.dealerSeat }],
  };
}

function requireHand(match: MatchState): HandState {
  if (!match.currentHand) fail("No hand is currently in progress.");
  return match.currentHand;
}

function handlePlaceBid(match: MatchState, seat: Seat, value: number | undefined): ActionResult {
  const hand = requireHand(match);
  if (hand.phase !== "BIDDING") fail("Bidding is not currently active.");

  const validation = validateBid(hand.bidding, seat, value);
  if (!validation.valid) fail(validation.reason ?? "Invalid bid.");

  const bidding = applyBid(hand.bidding, seat, value);
  const events: EngineEvent[] = [
    { type: "BID_PLACED", entry: bidding.entries[bidding.entries.length - 1] },
  ];

  let updatedHand: HandState = { ...hand, bidding };

  if (bidding.phase === "COMPLETE") {
    updatedHand = { ...updatedHand, phase: "TRUMP_SELECTION", currentTurn: bidding.winningSeat! };
    events.push({ type: "BIDDING_COMPLETE", winningSeat: bidding.winningSeat!, value: bidding.highestBid!.value });
  }

  return { state: { ...match, currentHand: updatedHand }, events };
}

function handleSelectTrump(match: MatchState, seat: Seat, suit: Suit): ActionResult {
  const hand = requireHand(match);
  if (hand.phase !== "TRUMP_SELECTION") fail("Trump cannot be selected right now.");
  if (hand.bidding.winningSeat !== seat) fail("Only the winning bidder may select trump.");

  const dealt = dealRemaining(hand.undealt);
  const players = { ...hand.players };
  for (const s of Object.keys(players).map(Number) as Seat[]) {
    players[s] = { seat: s, hand: [...players[s].hand, ...dealt[s]] };
  }

  const updatedHand: HandState = {
    ...hand,
    phase: "PLAYING",
    trumpSuit: suit,
    players,
    undealt: [],
    currentTurn: hand.bidding.winningSeat!,
    currentTrick: [],
    leadSuit: undefined,
  };

  return {
    state: { ...match, currentHand: updatedHand },
    events: [
      { type: "TRUMP_SELECTED", suit },
      { type: "REMAINING_DEALT" },
    ],
  };
}

function handlePlayCard(match: MatchState, seat: Seat, card: Card): ActionResult {
  const hand = requireHand(match);
  if (hand.phase !== "PLAYING") fail("No trick is currently in progress.");
  if (hand.currentTurn !== seat) fail(`It is seat ${hand.currentTurn}'s turn, not seat ${seat}.`);

  const playerHand = hand.players[seat].hand;
  const inHand = playerHand.some((c) => cardId(c) === cardId(card));
  if (!inHand) fail("That card is not in your hand.");
  if (!isLegalPlay(playerHand, hand.leadSuit, card)) {
    fail("You must follow the leading suit when you are able to.");
  }

  const remainingHand = playerHand.filter((c) => cardId(c) !== cardId(card));
  const players = { ...hand.players, [seat]: { seat, hand: remainingHand } };
  const currentTrick: PlayedCard[] = [...hand.currentTrick, { seat, card }];
  const leadSuit = hand.leadSuit ?? card.suit;

  const events: EngineEvent[] = [{ type: "CARD_PLAYED", seat, card }];

  if (currentTrick.length < 4) {
    const updatedHand: HandState = {
      ...hand,
      players,
      currentTrick,
      leadSuit,
      currentTurn: nextSeat(seat),
    };
    return { state: { ...match, currentHand: updatedHand }, events };
  }

  // Trick complete — resolve winner and run the streak/hand-collection mechanic.
  const trickNumber = hand.tricksPlayed.length + 1;
  const winningSeat = resolveTrick(currentTrick, leadSuit, hand.trumpSuit!);
  const streakResult = recordTrickWin(hand.streak, winningSeat, trickNumber);

  const trickResult = { trickNumber, leadSuit, cards: currentTrick, winningSeat };

  events.push({
    type: "TRICK_RESOLVED",
    trick: trickResult,
    streak: streakResult.streak,
    handsCollected: streakResult.handsCollected,
  });

  let updatedHand: HandState = {
    ...hand,
    players,
    currentTrick: [],
    leadSuit: undefined,
    currentTurn: winningSeat,
    tricksPlayed: [...hand.tricksPlayed, trickResult],
    streak: streakResult.streak,
  };

  let updatedMatch: MatchState = { ...match, currentHand: updatedHand };

  if (trickNumber === TRICKS_PER_HAND) {
    assertHandInvariant(streakResult.streak);

    const bidderSeat = hand.bidding.winningSeat!;
    const declaredBid = hand.bidding.highestBid!.value;
    const biddingTeam = teamForSeat(bidderSeat);
    const biddingTeamHands = biddingTeam === "A" ? streakResult.streak.teamAHands : streakResult.streak.teamBHands;

    const penalty = computeHandPenalty(biddingTeam, declaredBid, biddingTeamHands);

    updatedHand = {
      ...updatedHand,
      phase: "COMPLETE",
      bidSuccess: penalty.bidSuccess,
      penaltyApplied: penalty.penaltyApplied,
      penaltyTeam: penalty.penaltyTeam,
    };

    const teamAPenalty = match.teamAPenalty + (penalty.penaltyTeam === "A" ? penalty.penaltyApplied : 0);
    const teamBPenalty = match.teamBPenalty + (penalty.penaltyTeam === "B" ? penalty.penaltyApplied : 0);

    updatedMatch = {
      ...match,
      currentHand: updatedHand,
      teamAPenalty,
      teamBPenalty,
      completedHands: [...match.completedHands, updatedHand],
    };

    events.push({
      type: "HAND_COMPLETE",
      bidderSeat,
      declaredBid,
      biddingTeam,
      bidSuccess: penalty.bidSuccess,
      penaltyApplied: penalty.penaltyApplied,
      penaltyTeam: penalty.penaltyTeam,
      teamAHands: streakResult.streak.teamAHands,
      teamBHands: streakResult.streak.teamBHands,
    });

    updatedMatch = checkMatchComplete(updatedMatch);
    if (updatedMatch.winningTeam) {
      events.push({
        type: "MATCH_COMPLETE",
        winningTeam: updatedMatch.winningTeam,
        teamAPenalty: updatedMatch.teamAPenalty,
        teamBPenalty: updatedMatch.teamBPenalty,
      });
    }
  }

  return { state: updatedMatch, events };
}
