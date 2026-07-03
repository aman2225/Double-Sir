// Core gameplay Socket.IO handlers: room lifecycle + bidding/trump/trick
// play + hand/match progression. Extracted from what used to be a single
// server/socketHandlers.ts so each concern (game, chat, voice, emoji) lives
// in its own module — behavior here is unchanged from before the split.

import { randomBytes } from "node:crypto";
import { applyAction, InvalidActionError } from "@/engine/reducer";
import { createMatch, prepareNextHand } from "@/engine/match";
import { Suit, Card } from "@/engine/types";
import { GameSession } from "./session";
import { createSession, getSession, allSessions } from "./rooms";
import { broadcastGameState, broadcastRoomState, requireSeated, withErrorHandling } from "./roomHelpers";
import { sendChatHistory } from "./chatHandlers";
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

async function startNewMatchAndHand(session: GameSession) {
  const matchRow = await createMatchInDb(session.roomId);
  session.matchDbId = matchRow.id;
  session.match = createMatch(session.roomCode);
  await startHandFlow(session);
}

export function registerGameHandlers(io: AppServer, socket: AppSocket) {
  const player = socket.data.player;

  socket.on("room:create", ({ displayName }, ack) => {
    // A client could theoretically omit the ack callback despite the typed
    // contract requiring one (TypeScript only enforces this at compile
    // time) — fall back to a no-op so a malformed call can't throw mid-handler
    // and abort before later steps run.
    const safeAck = typeof ack === "function" ? ack : () => {};
    (async () => {
      try {
        const room = await createRoomInDb(player.playerProfileId);
        const session = new GameSession(room.code, room.id, player.playerProfileId);
        session.addOccupant(1, player.playerProfileId, displayName || player.displayName, player.avatarUrl, socket.id);
        createSession(session);
        socket.join(room.code);
        safeAck({ ok: true, data: { roomCode: room.code } });
        broadcastRoomState(io, session);
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

        const seat = session.nextOpenSeat()!;
        await addRoomPlayer(session.roomId, seat, player.playerProfileId);
        session.addOccupant(seat, player.playerProfileId, displayName || player.displayName, player.avatarUrl, socket.id);
        socket.join(session.roomCode);
        safeAck({ ok: true, data: { roomCode: session.roomCode } });
        broadcastRoomState(io, session);
        io.to(session.roomCode).emit("player:joined", { seat, displayName: displayName || player.displayName });
        sendChatHistory(socket, session);
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

      broadcastGameState(io, session);
    });
  });

  socket.on("card:play", ({ roomCode, card }) => {
    withErrorHandling(socket, async () => {
      const { session, occupant } = requireSeated(roomCode, player.playerProfileId);
      if (!session.match) throw new InvalidActionError("No hand is in progress.");

      const result = applyAction(session.match, { type: "PLAY_CARD", seat: occupant.seat, card: card as Card });
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
          session.status = "MATCH_COMPLETE";
          await setRoomStatus(session.roomId, "MATCH_COMPLETE");
          io.to(roomCode).emit("match:complete", {
            winningTeam: event.winningTeam,
            teamAPenalty: event.teamAPenalty,
            teamBPenalty: event.teamBPenalty,
            handsPlayed: session.match!.completedHands.length,
          });
        }
      }

      broadcastGameState(io, session);
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
      broadcastRoomState(io, session);
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
