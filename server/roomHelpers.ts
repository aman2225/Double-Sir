// Small helpers shared by every handler module (game/chat/voice/emoji) —
// resolving a room + seat from a claimed playerProfileId, and broadcasting
// room/game state snapshots. Extracted from server/socketHandlers.ts so
// each handler module can use them without importing the orchestrator.

import { InvalidActionError } from "@/engine/reducer";
import { RoomStateView } from "@/sockets/events";
import { redactMatchForSeat } from "@/sockets/redact";
import { GameSession, SeatOccupant } from "./session";
import { getSession } from "./rooms";
import { AppServer, AppSocket } from "./types";

export function requireSeated(roomCode: string, playerProfileId: string): { session: GameSession; occupant: SeatOccupant } {
  const session = getSession(roomCode);
  if (!session) throw new InvalidActionError("Room not found.");
  const occupant = session.seatFor(playerProfileId);
  if (!occupant) throw new InvalidActionError("You are not seated in this room.");
  return { session, occupant };
}

export function buildRoomStateView(session: GameSession): RoomStateView {
  return {
    roomCode: session.roomCode,
    status: session.status,
    hostPlayerProfileId: session.hostPlayerProfileId,
    players: [...session.seats.values()]
      .sort((a, b) => a.seat - b.seat)
      .map((o) => ({
        seat: o.seat,
        team: o.team,
        playerProfileId: o.playerProfileId,
        displayName: o.displayName,
        avatarUrl: o.avatarUrl,
        connected: o.connected,
        isHost: o.playerProfileId === session.hostPlayerProfileId,
      })),
  };
}

export function broadcastRoomState(io: AppServer, session: GameSession) {
  io.to(session.roomCode).emit("room:state", buildRoomStateView(session));
}

export function broadcastGameState(io: AppServer, session: GameSession) {
  if (!session.match) return;
  for (const occupant of session.seats.values()) {
    if (occupant.socketId) {
      io.to(occupant.socketId).emit("game:state", redactMatchForSeat(session.match, occupant.seat));
    }
  }
}

/** Runs an async handler body, turning InvalidActionError into a client-visible error and anything else into a logged, generic one — never lets a handler crash the server process. */
export function withErrorHandling(socket: AppSocket, fn: () => Promise<void>): Promise<void> {
  return fn().catch((err) => {
    if (err instanceof InvalidActionError) {
      socket.emit("error:invalidMove", { message: err.message });
      return;
    }
    console.error("Unhandled socket handler error:", err);
    socket.emit("error:invalidMove", { message: "Something went wrong processing that action." });
  });
}
