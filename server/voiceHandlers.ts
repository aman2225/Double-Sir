// WebRTC signaling relay. This module NEVER touches audio — it only relays
// offer/answer/ICE candidates (and small status messages) between the
// exactly-4 seats of a room. Every payload addresses the other party by
// `seat`; the server resolves `seat -> socketId` itself via
// `session.seats`, so a client can never spoof which peer a message reaches.

import { Seat } from "@/engine/types";
import { createSignalingBucket } from "./rateLimit";
import { requireSeated, withErrorHandling } from "./roomHelpers";
import { allSessions } from "./rooms";
import { AppServer, AppSocket } from "./types";

const MAX_SDP_LENGTH = 10_000;
const MAX_ICE_CANDIDATE_LENGTH = 2_000;

export function registerVoiceHandlers(io: AppServer, socket: AppSocket) {
  const player = socket.data.player;

  function consumeSignalingToken(): boolean {
    socket.data.signalingBucket ??= createSignalingBucket();
    return socket.data.signalingBucket.consume();
  }

  socket.on("voice:ready", ({ roomCode }) => {
    withErrorHandling(socket, async () => {
      const { session, occupant } = requireSeated(roomCode, player.playerProfileId);
      session.voiceReadySeats.add(occupant.seat);

      const roster = [...session.voiceReadySeats]
        .filter((seat) => seat !== occupant.seat)
        .map((seat) => ({
          seat,
          playerProfileId: session.seats.get(seat)!.playerProfileId,
          muted: session.mutedSeats.has(seat),
        }));
      socket.emit("voice:roster", { seats: roster });

      socket.to(roomCode).emit("voice:peer-joined", {
        seat: occupant.seat,
        playerProfileId: occupant.playerProfileId,
        muted: session.mutedSeats.has(occupant.seat),
      });
    });
  });

  socket.on("voice:leave", ({ roomCode }) => {
    withErrorHandling(socket, async () => {
      const { session, occupant } = requireSeated(roomCode, player.playerProfileId);
      session.voiceReadySeats.delete(occupant.seat);
      session.mutedSeats.delete(occupant.seat);
      io.to(roomCode).emit("voice:peer-left", { seat: occupant.seat });
    });
  });

  socket.on("voice:offer", ({ roomCode, toSeat, sdp }) => {
    withErrorHandling(socket, async () => {
      const { session, occupant } = requireSeated(roomCode, player.playerProfileId);
      if (!consumeSignalingToken() || sdp.length > MAX_SDP_LENGTH) return;
      const target = session.seats.get(toSeat as Seat);
      if (!target?.socketId) return;
      io.to(target.socketId).emit("voice:offer", { fromSeat: occupant.seat, sdp });
    });
  });

  socket.on("voice:answer", ({ roomCode, toSeat, sdp }) => {
    withErrorHandling(socket, async () => {
      const { session, occupant } = requireSeated(roomCode, player.playerProfileId);
      if (!consumeSignalingToken() || sdp.length > MAX_SDP_LENGTH) return;
      const target = session.seats.get(toSeat as Seat);
      if (!target?.socketId) return;
      io.to(target.socketId).emit("voice:answer", { fromSeat: occupant.seat, sdp });
    });
  });

  socket.on("voice:ice-candidate", ({ roomCode, toSeat, candidate }) => {
    withErrorHandling(socket, async () => {
      const { session, occupant } = requireSeated(roomCode, player.playerProfileId);
      if (!consumeSignalingToken() || candidate.length > MAX_ICE_CANDIDATE_LENGTH) return;
      const target = session.seats.get(toSeat as Seat);
      if (!target?.socketId) return;
      io.to(target.socketId).emit("voice:ice-candidate", { fromSeat: occupant.seat, candidate });
    });
  });

  socket.on("voice:mute-status", ({ roomCode, muted }) => {
    withErrorHandling(socket, async () => {
      const { session, occupant } = requireSeated(roomCode, player.playerProfileId);
      if (muted) session.mutedSeats.add(occupant.seat);
      else session.mutedSeats.delete(occupant.seat);
      io.to(roomCode).emit("voice:mute-status", { seat: occupant.seat, muted });
    });
  });

  socket.on("voice:speaking", ({ roomCode, speaking }) => {
    withErrorHandling(socket, async () => {
      const { occupant } = requireSeated(roomCode, player.playerProfileId);
      // Client only emits on speaking-state transitions (debounced), so this
      // is naturally low-frequency and doesn't need its own token bucket.
      socket.to(roomCode).emit("voice:speaking", { seat: occupant.seat, speaking });
    });
  });

  socket.on("disconnect", () => {
    withErrorHandling(socket, async () => {
      for (const session of allSessions()) {
        const occupant = session.seatForSocket(socket.id);
        if (!occupant || !session.voiceReadySeats.has(occupant.seat)) continue;
        session.voiceReadySeats.delete(occupant.seat);
        session.mutedSeats.delete(occupant.seat);
        io.to(session.roomCode).emit("voice:peer-left", { seat: occupant.seat });
      }
    });
  });
}
