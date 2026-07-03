// Server-authoritative 30s turn timer for card-play turns. The server is
// the sole source of truth for the deadline and for what happens at zero —
// clients only ever render a countdown derived from the deadline broadcast
// in game:state (see sockets/redact.ts), never decide anything themselves.
//
// `syncTurnTimer` is called from server/gameHandlers.ts right before every
// existing broadcastGameState() call, piggybacking on those call sites
// instead of adding a parallel state machine. `applyCardPlay` is passed in
// by the caller (rather than imported here) specifically to avoid a
// circular import: gameHandlers.ts needs syncTurnTimer, and the timeout
// callback here needs to invoke the same "apply a card play" logic that
// gameHandlers.ts owns.

import { Card, Seat } from "@/engine/types";
import { chooseAutoPlayCard } from "@/engine/autoPlay";
import { GameSession } from "./session";
import { AppServer } from "./types";

const TURN_MS = 30_000;

type ApplyCardPlay = (io: AppServer, session: GameSession, seat: Seat, card: Card) => Promise<void>;

export function syncTurnTimer(io: AppServer, session: GameSession, applyCardPlay: ApplyCardPlay) {
  if (session.turnTimer) {
    clearTimeout(session.turnTimer);
    session.turnTimer = undefined;
  }

  const hand = session.match?.currentHand;
  if (!hand || hand.phase !== "PLAYING") {
    session.turnDeadline = undefined;
    return;
  }

  const seat = hand.currentTurn;
  const handNumber = hand.handNumber;
  const tricksPlayedCount = hand.tricksPlayed.length;
  session.turnDeadline = Date.now() + TURN_MS;

  session.turnTimer = setTimeout(() => {
    void handleTurnTimeout(io, session, seat, handNumber, tricksPlayedCount, applyCardPlay);
  }, TURN_MS);
}

async function handleTurnTimeout(
  io: AppServer,
  session: GameSession,
  seat: Seat,
  handNumber: number,
  tricksPlayedCount: number,
  applyCardPlay: ApplyCardPlay
) {
  const hand = session.match?.currentHand;
  // Stale-firing guard: Node clears the single per-session timeout on every
  // reschedule, so this can't race a real play in practice — but re-verify
  // the turn is still exactly the one this timer was armed for before
  // acting, as a one-line safety net.
  if (!hand || hand.phase !== "PLAYING") return;
  if (hand.handNumber !== handNumber || hand.currentTurn !== seat || hand.tricksPlayed.length !== tricksPlayedCount) return;

  const playerHand = hand.players[seat].hand;
  const card = chooseAutoPlayCard(playerHand, hand.leadSuit, hand.trumpSuit);
  io.to(session.roomCode).emit("turn:autoPlayed", { seat, card });
  await applyCardPlay(io, session, seat, card);
}
