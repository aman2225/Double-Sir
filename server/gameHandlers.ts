// Core gameplay Socket.IO handlers: room lifecycle + bidding/trump/trick
// play + hand/match progression. Extracted from what used to be a single
// server/socketHandlers.ts so each concern (game, chat, voice, emoji) lives
// in its own module — behavior here is unchanged from before the split.

import { randomBytes } from "node:crypto";
import { applyAction, InvalidActionError } from "@/engine/reducer";
import { createMatch, prepareNextHand } from "@/engine/match";
import { Seat, Suit, Card } from "@/engine/types";
import { isValidEntryFee, prizePerWinner, prizePool } from "@/lib/coinEconomy";
import { GameSession } from "./session";
import { createSession, getSession, allSessions } from "./rooms";
import { broadcastGameState, broadcastRoomState, requireSeated, withErrorHandling } from "./roomHelpers";
import { sendChatHistory } from "./chatHandlers";
import { sendMusicState } from "./musicHandlers";
import { syncTurnTimer } from "./turnTimer";
import { deductEntryFees, refundEntryFees, creditMatchPrize, getWalletSnapshot } from "./wallet";
import { AppServer, AppSocket } from "./types";
import {
  addRoomPlayer,
  bumpBidderStats,
  bumpPlayerStatsForHand,
  bumpPlayerStatsForMatch,
  completeHandInDb,
  completeMatchInDb,
  createHandInDb,
  createMatchInDb,
  createRoomInDb,
  recordBidInDb,
  recordTrickInDb,
  recordTrumpSelection,
  setPlayerConnection,
  setRoomStatus,
  snapshotHandState,
  updateMatchPenalties,
} from "./persistence";

function shuffleSeed(): string {
  return randomBytes(16).toString("hex");
}

async function startHandFlow(session: GameSession) {
  const seed = shuffleSeed();
  const result = applyAction(session.match!, { type: "START_HAND", shuffleSeed: seed });
  session.match = result.state;
  const hand = session.match.currentHand!;
  const handRow = await createHandInDb(session.matchDbId!, hand.handNumber, hand.dealerSeat, seed);
  session.handDbId = handRow.id;
  session.status = "BIDDING";
  await setRoomStatus(session.roomId, "BIDDING");
}

/**
 * Creates the Match row, collects entry fees (if any), then starts the
 * first hand. The `startingMatch` re-entrancy lock is set synchronously
 * before any await so two rapid calls (double-click, replay) can't both
 * pass and double-charge every player — see server/session.ts.
 */
async function startNewMatchAndHand(session: GameSession) {
  if (session.startingMatch) {
    throw new InvalidActionError("A match is already starting for this room.");
  }
  session.startingMatch = true;
  try {
    const playerProfileIds = [...session.seats.values()].map((o) => o.playerProfileId);
    const matchRow = await createMatchInDb(session.roomId, session.entryFee, prizePool(session.entryFee));
    session.matchDbId = matchRow.id;

    if (session.entryFee > 0) {
      // All-or-nothing: throws (and charges NOBODY) if any player can't
      // afford it. The Match row above is left as a harmless "never
      // started" artifact in that case (no hands, endedAt stays null).
      await deductEntryFees(playerProfileIds, session.entryFee, session.roomId, matchRow.id);
    }

    try {
      session.match = createMatch(session.roomCode, session.targetPoints);
      await startHandFlow(session);
    } catch (err) {
      if (session.entryFee > 0) {
        await refundEntryFees(playerProfileIds, session.entryFee, session.roomId, matchRow.id).catch((refundErr) =>
          console.error("Failed to refund entry fees after match-start failure:", refundErr)
        );
      }
      throw err;
    }
  } finally {
    session.startingMatch = false;
  }
}

/**
 * Applies a PLAY_CARD action and everything that follows from it (trick/
 * hand/match persistence + emits, turn-timer resync, state broadcast).
 * Shared by the real `card:play` socket handler and server/turnTimer.ts's
 * auto-play-on-timeout — identical logic either way, just a different
 * source for `seat`/`card`.
 */
export async function applyCardPlay(io: AppServer, session: GameSession, seat: Seat, card: Card) {
  const roomCode = session.roomCode;
  const result = applyAction(session.match!, { type: "PLAY_CARD", seat, card });
  session.match = result.state;

  for (const event of result.events) {
    if (event.type === "TRICK_RESOLVED") {
      const winningOccupant = session.seats.get(event.trick.winningSeat);
      await recordTrickInDb(
        session.handDbId!,
        event.trick.trickNumber,
        event.trick.leadSuit,
        event.trick.winningSeat,
        winningOccupant?.playerProfileId,
        event.trick.cards,
        event.streak.currentStreakPlayer,
        event.streak.currentStreakCount,
        event.streak.unclaimedHands
      );
      await snapshotHandState(session.handDbId!, session.match!.currentHand!);
      io.to(roomCode).emit("trick:resolved", {
        trick: event.trick,
        streak: event.streak,
        handsCollected: event.handsCollected,
      });
    }

    if (event.type === "HAND_COMPLETE") {
      await completeHandInDb(session.handDbId!, {
        teamAHands: event.teamAHands,
        teamBHands: event.teamBHands,
        bidSuccess: event.bidSuccess,
        penaltyApplied: event.penaltyApplied,
        penaltyTeam: event.penaltyTeam,
      });
      await updateMatchPenalties(session.matchDbId!, session.match!.teamAPenalty, session.match!.teamBPenalty);

      const bidderOccupant = session.seats.get(event.bidderSeat);
      if (bidderOccupant) await bumpBidderStats(bidderOccupant.playerProfileId, event.bidSuccess);

      const handWinningTeam = event.teamAHands > event.teamBHands ? "A" : "B";
      for (const occ of session.seats.values()) {
        await bumpPlayerStatsForHand(occ.playerProfileId, occ.team === handWinningTeam);
      }

      session.status = "HAND_COMPLETE";
      await setRoomStatus(session.roomId, "HAND_COMPLETE");
      io.to(roomCode).emit("hand:complete", {
        ...event,
        teamAPenalty: session.match!.teamAPenalty,
        teamBPenalty: session.match!.teamBPenalty,
      });
    }

    if (event.type === "MATCH_COMPLETE") {
      await completeMatchInDb(session.matchDbId!, event.winningTeam);
      for (const occ of session.seats.values()) {
        await bumpPlayerStatsForMatch(occ.playerProfileId, occ.team === event.winningTeam);
      }

      let prizePerWinnerAmount = 0;
      if (session.entryFee > 0) {
        prizePerWinnerAmount = prizePerWinner(session.entryFee);
        const winningOccupants = [...session.seats.values()].filter((occ) => occ.team === event.winningTeam);
        const newBalances = await creditMatchPrize(
          winningOccupants.map((occ) => occ.playerProfileId),
          session.entryFee,
          session.roomId,
          session.matchDbId!
        );
        for (const occ of winningOccupants) {
          const snapshot = newBalances.get(occ.playerProfileId);
          if (snapshot && occ.socketId) {
            io.to(occ.socketId).emit("wallet:balance", snapshot);
          }
        }
      }

      session.status = "MATCH_COMPLETE";
      await setRoomStatus(session.roomId, "MATCH_COMPLETE");
      io.to(roomCode).emit("match:complete", {
        winningTeam: event.winningTeam,
        teamAPenalty: event.teamAPenalty,
        teamBPenalty: event.teamBPenalty,
        handsPlayed: session.match!.completedHands.length,
        prizePerWinner: prizePerWinnerAmount,
      });
    }
  }

  syncTurnTimer(io, session, applyCardPlay);
  broadcastGameState(io, session);
}

export function registerGameHandlers(io: AppServer, socket: AppSocket) {
  const player = socket.data.player;

  socket.on("room:create", ({ displayName, entryFee, roomName, targetPoints, isPrivate, inviteCode }, ack) => {
    // A client could theoretically omit the ack callback despite the typed
    // contract requiring one (TypeScript only enforces this at compile
    // time) — fall back to a no-op so a malformed call can't throw mid-handler
    // and abort before later steps run.
    const safeAck = typeof ack === "function" ? ack : () => {};
    (async () => {
      try {
        if (!isValidEntryFee(entryFee)) {
          safeAck({ ok: false, error: "Invalid entry fee — choose one of the listed room tiers." });
          return;
        }
        let validTarget = 53;
        if (typeof targetPoints === "number" && !isNaN(targetPoints)) {
          validTarget = Math.max(20, Math.min(500, Math.round(targetPoints)));
        }
        const priv = isPrivate ?? true;
        const room = await createRoomInDb(player.playerProfileId, entryFee, roomName, priv);
        const session = new GameSession(
          room.code,
          room.id,
          player.playerProfileId,
          entryFee,
          roomName ?? undefined,
          priv,
          validTarget,
          inviteCode
        );
        session.addOccupant(1, player.playerProfileId, displayName || player.displayName, player.avatarUrl, socket.id);
        createSession(session);
        socket.join(room.code);
        safeAck({ ok: true, data: { roomCode: room.code } });
        broadcastRoomState(io, session);
        sendMusicState(socket, session);
      } catch (err) {
        console.error("room:create failed:", err);
        safeAck({ ok: false, error: "Failed to create room." });
      }
    })();
  });

  socket.on("room:join", ({ roomCode, displayName }, ack) => {
    const safeAck = typeof ack === "function" ? ack : () => {};
    (async () => {
      try {
        const session = getSession(roomCode);
        if (!session) {
          safeAck({ ok: false, error: "Room not found." });
          return;
        }

        const existingSeat = session.seatFor(player.playerProfileId);
        if (existingSeat) {
          existingSeat.connected = true;
          existingSeat.socketId = socket.id;
          socket.join(session.roomCode);
          await setPlayerConnection(session.roomId, existingSeat.seat, true, socket.id);
          safeAck({ ok: true, data: { roomCode: session.roomCode } });
          broadcastRoomState(io, session);
          io.to(session.roomCode).emit("player:reconnected", { seat: existingSeat.seat });
          sendChatHistory(socket, session);
          sendMusicState(socket, session);
          if (session.match) broadcastGameState(io, session);
          return;
        }

        if (session.isFull) {
          safeAck({ ok: false, error: "Room is full." });
          return;
        }
        if (session.status !== "LOBBY") {
          safeAck({ ok: false, error: "Match already in progress." });
          return;
        }

        if (session.entryFee > 0) {
          const wallet = await getWalletSnapshot(player.playerProfileId);
          const balance = wallet?.balance ?? 0;
          if (balance < session.entryFee) {
            safeAck({
              ok: false,
              error: `Insufficient coins: this room requires ${session.entryFee}, you have ${balance}.`,
            });
            return;
          }
        }

        const seat = session.nextOpenSeat()!;
        await addRoomPlayer(session.roomId, seat, player.playerProfileId);
        session.addOccupant(seat, player.playerProfileId, displayName || player.displayName, player.avatarUrl, socket.id);
        socket.join(session.roomCode);
        safeAck({ ok: true, data: { roomCode: session.roomCode } });
        broadcastRoomState(io, session);
        io.to(session.roomCode).emit("player:joined", { seat, displayName: displayName || player.displayName });
        sendChatHistory(socket, session);
        sendMusicState(socket, session);
      } catch (err) {
        console.error("room:join failed:", err);
        safeAck({ ok: false, error: "Failed to join room." });
      }
    })();
  });

  socket.on("room:leave", ({ roomCode }) => {
    withErrorHandling(socket, async () => {
      const session = getSession(roomCode);
      if (!session) return;
      const occupant = session.seatForSocket(socket.id);
      if (!occupant) return;
      socket.leave(roomCode);
      if (session.status === "LOBBY") {
        session.seats.delete(occupant.seat);
        io.to(roomCode).emit("player:left", { seat: occupant.seat, displayName: occupant.displayName });
      } else {
        occupant.connected = false;
        occupant.socketId = undefined;
        await setPlayerConnection(session.roomId, occupant.seat, false, null);
      }
      broadcastRoomState(io, session);
    });
  });

  socket.on("game:start", ({ roomCode }) => {
    withErrorHandling(socket, async () => {
      const session = getSession(roomCode);
      if (!session) throw new InvalidActionError("Room not found.");
      if (session.hostPlayerProfileId !== player.playerProfileId) {
        throw new InvalidActionError("Only the host can start the game.");
      }
      if (!session.isFull) throw new InvalidActionError("Need 4 players to start.");
      if (session.match) throw new InvalidActionError("Game already started.");

      await startNewMatchAndHand(session);
      syncTurnTimer(io, session, applyCardPlay);
      broadcastRoomState(io, session);
      broadcastGameState(io, session);
    });
  });

  socket.on("bid:place", ({ roomCode, value }) => {
    withErrorHandling(socket, async () => {
      const { session, occupant } = requireSeated(roomCode, player.playerProfileId);
      if (!session.match) throw new InvalidActionError("No hand is in progress.");

      const result = applyAction(session.match, { type: "PLACE_BID", seat: occupant.seat, value });
      session.match = result.state;

      for (const event of result.events) {
        if (event.type === "BID_PLACED") {
          await recordBidInDb(session.handDbId!, occupant.playerProfileId, event.entry.seat, event.entry.sequence, event.entry.value);
          io.to(roomCode).emit("bid:updated", event.entry);
        }
        if (event.type === "BIDDING_COMPLETE") {
          session.status = "TRUMP_SELECT";
          await setRoomStatus(session.roomId, "TRUMP_SELECT");
          io.to(roomCode).emit("bidding:complete", { winningSeat: event.winningSeat, value: event.value });
        }
      }

      broadcastGameState(io, session);
    });
  });

  socket.on("trump:select", ({ roomCode, suit }) => {
    withErrorHandling(socket, async () => {
      const { session, occupant } = requireSeated(roomCode, player.playerProfileId);
      if (!session.match) throw new InvalidActionError("No hand is in progress.");

      const bidderSeat = occupant.seat;
      const declaredBid = session.match.currentHand?.bidding.highestBid?.value ?? 0;

      const result = applyAction(session.match, { type: "SELECT_TRUMP", seat: occupant.seat, suit: suit as Suit });
      session.match = result.state;

      await recordTrumpSelection(session.handDbId!, bidderSeat, declaredBid, suit as Suit);
      session.status = "PLAYING";
      await setRoomStatus(session.roomId, "PLAYING");
      io.to(roomCode).emit("trump:selected", { suit: suit as Suit });

      syncTurnTimer(io, session, applyCardPlay);
      broadcastGameState(io, session);
    });
  });

  socket.on("card:play", ({ roomCode, card }) => {
    withErrorHandling(socket, async () => {
      const { session, occupant } = requireSeated(roomCode, player.playerProfileId);
      if (!session.match) throw new InvalidActionError("No hand is in progress.");
      await applyCardPlay(io, session, occupant.seat, card as Card);
    });
  });

  socket.on("hand:continue", ({ roomCode }) => {
    withErrorHandling(socket, async () => {
      const { session } = requireSeated(roomCode, player.playerProfileId);
      if (session.hostPlayerProfileId !== player.playerProfileId) {
        throw new InvalidActionError("Only the host can continue to the next hand.");
      }
      if (!session.match || session.match.currentHand?.phase !== "COMPLETE") {
        throw new InvalidActionError("Current hand has not finished yet.");
      }
      if (session.match.winningTeam) {
        throw new InvalidActionError("The match has already ended.");
      }

      session.match = prepareNextHand(session.match);
      await startHandFlow(session);
      syncTurnTimer(io, session, applyCardPlay);
      broadcastRoomState(io, session);
      broadcastGameState(io, session);
    });
  });

  socket.on("match:playAgain", ({ roomCode }) => {
    withErrorHandling(socket, async () => {
      const { session } = requireSeated(roomCode, player.playerProfileId);
      if (session.hostPlayerProfileId !== player.playerProfileId) {
        throw new InvalidActionError("Only the host can start a rematch.");
      }
      if (!session.match?.winningTeam) throw new InvalidActionError("The current match has not ended yet.");

      await startNewMatchAndHand(session);
      syncTurnTimer(io, session, applyCardPlay);
      broadcastRoomState(io, session);
      broadcastGameState(io, session);
    });
  });

  socket.on("match:newMatch", ({ roomCode }) => {
    withErrorHandling(socket, async () => {
      const { session } = requireSeated(roomCode, player.playerProfileId);
      if (session.hostPlayerProfileId !== player.playerProfileId) {
        throw new InvalidActionError("Only the host can return to the lobby.");
      }

      session.match = undefined;
      session.matchDbId = undefined;
      session.handDbId = undefined;
      session.status = "LOBBY";
      await setRoomStatus(session.roomId, "LOBBY");
      // Never calls broadcastGameState (no match) — clear any lingering timer explicitly.
      syncTurnTimer(io, session, applyCardPlay);
      broadcastRoomState(io, session);
    });
  });

  socket.on("ping:latency", (ack) => {
    if (typeof ack === "function") ack(true);
  });

  socket.on("connection:quality", ({ roomCode, quality }) => {
    withErrorHandling(socket, async () => {
      const { occupant } = requireSeated(roomCode, player.playerProfileId);
      io.to(roomCode).emit("connection:quality", { seat: occupant.seat, quality });
    });
  });

  socket.on("disconnect", () => {
    withErrorHandling(socket, async () => {
      for (const session of allSessions()) {
        const occupant = session.seatForSocket(socket.id);
        if (!occupant) continue;
        occupant.connected = false;
        occupant.socketId = undefined;
        await setPlayerConnection(session.roomId, occupant.seat, false, null);
        io.to(session.roomCode).emit("player:disconnected", { seat: occupant.seat });
        broadcastRoomState(io, session);
      }
    });
  });
}
