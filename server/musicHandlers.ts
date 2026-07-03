// Synchronized room-music Socket.IO handlers. Every control event is
// host-only, enforced here (never trust the client) — same pattern as the
// host checks already in server/gameHandlers.ts (game:start, hand:continue,
// ...). The server is the sole source of truth for what's playing and at
// what timestamp; clients only ever render what they're told.

import { InvalidActionError } from "@/engine/reducer";
import { findTrack, MUSIC_LIBRARY } from "@/lib/musicLibrary";
import { MusicNotificationAction } from "@/sockets/musicEvents";
import { GameSession, SeatOccupant } from "./session";
import { requireSeated, withErrorHandling } from "./roomHelpers";
import { syncMusicTimer } from "./musicTimer";
import { AppServer, AppSocket } from "./types";

function livePositionMs(session: GameSession): number {
  const m = session.music;
  if (m.status === "playing" && m.playbackStartEpoch !== undefined) {
    return m.positionMs + (Date.now() - m.playbackStartEpoch);
  }
  return m.positionMs;
}

function shuffled(ids: string[]): string[] {
  const arr = [...ids];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Loads `trackId` at position 0 and starts playing it immediately. */
function changeTrack(session: GameSession, trackId: string) {
  const m = session.music;
  const idx = m.order.indexOf(trackId);
  if (idx === -1) throw new InvalidActionError("Unknown track.");
  m.index = idx;
  m.trackId = trackId;
  m.positionMs = 0;
  m.playbackStartEpoch = Date.now();
  m.status = "playing";
}

function advanceTrack(session: GameSession, direction: "next" | "previous") {
  const m = session.music;
  if (m.order.length === 0) throw new InvalidActionError("The music library is empty.");
  if (direction === "next") {
    m.index = m.index + 1 < m.order.length ? m.index + 1 : m.repeat === "all" ? 0 : m.order.length - 1;
  } else {
    m.index = m.index - 1 >= 0 ? m.index - 1 : m.repeat === "all" ? m.order.length - 1 : 0;
  }
  m.trackId = m.order[m.index];
  m.positionMs = 0;
  m.playbackStartEpoch = Date.now();
  m.status = "playing";
}

export function sendMusicState(socket: AppSocket, session: GameSession) {
  socket.emit("music:state", session.music);
}

export function registerMusicHandlers(io: AppServer, socket: AppSocket) {
  const player = socket.data.player;

  function requireHost(roomCode: string): { session: GameSession; occupant: SeatOccupant } {
    const { session, occupant } = requireSeated(roomCode, player.playerProfileId);
    if (session.hostPlayerProfileId !== player.playerProfileId) {
      throw new InvalidActionError("Only the room host can control the music.");
    }
    return { session, occupant };
  }

  function commit(session: GameSession, occupant: SeatOccupant, action: MusicNotificationAction, trackTitle?: string) {
    syncMusicTimer(io, session);
    io.to(session.roomCode).emit("music:state", session.music);
    io.to(session.roomCode).emit("music:notification", {
      seat: occupant.seat,
      displayName: occupant.displayName,
      action,
      trackTitle,
    });
  }

  socket.on("music:play", ({ roomCode, trackId }) => {
    withErrorHandling(socket, async () => {
      const { session, occupant } = requireHost(roomCode);
      const m = session.music;
      if (trackId) {
        changeTrack(session, trackId);
        commit(session, occupant, "changed", findTrack(trackId)?.title);
        return;
      }
      if (m.status === "paused" && m.trackId) {
        m.playbackStartEpoch = Date.now();
        m.status = "playing";
        commit(session, occupant, "resumed", findTrack(m.trackId)?.title);
        return;
      }
      const startId = m.trackId ?? m.order[0];
      if (!startId) throw new InvalidActionError("No tracks available.");
      changeTrack(session, startId);
      commit(session, occupant, "started", findTrack(startId)?.title);
    });
  });

  socket.on("music:pause", ({ roomCode }) => {
    withErrorHandling(socket, async () => {
      const { session, occupant } = requireHost(roomCode);
      const m = session.music;
      if (m.status === "playing") {
        m.positionMs = livePositionMs(session);
        m.playbackStartEpoch = undefined;
        m.status = "paused";
      }
      commit(session, occupant, "paused", findTrack(m.trackId)?.title);
    });
  });

  socket.on("music:resume", ({ roomCode }) => {
    withErrorHandling(socket, async () => {
      const { session, occupant } = requireHost(roomCode);
      const m = session.music;
      if (m.status === "paused" && m.trackId) {
        m.playbackStartEpoch = Date.now();
        m.status = "playing";
      }
      commit(session, occupant, "resumed", findTrack(m.trackId)?.title);
    });
  });

  socket.on("music:stop", ({ roomCode }) => {
    withErrorHandling(socket, async () => {
      const { session, occupant } = requireHost(roomCode);
      const m = session.music;
      m.status = "stopped";
      m.positionMs = 0;
      m.playbackStartEpoch = undefined;
      commit(session, occupant, "stopped");
    });
  });

  socket.on("music:next", ({ roomCode }) => {
    withErrorHandling(socket, async () => {
      const { session, occupant } = requireHost(roomCode);
      advanceTrack(session, "next");
      commit(session, occupant, "changed", findTrack(session.music.trackId)?.title);
    });
  });

  socket.on("music:previous", ({ roomCode }) => {
    withErrorHandling(socket, async () => {
      const { session, occupant } = requireHost(roomCode);
      advanceTrack(session, "previous");
      commit(session, occupant, "changed", findTrack(session.music.trackId)?.title);
    });
  });

  socket.on("music:selectTrack", ({ roomCode, trackId }) => {
    withErrorHandling(socket, async () => {
      const { session, occupant } = requireHost(roomCode);
      changeTrack(session, trackId);
      commit(session, occupant, "changed", findTrack(trackId)?.title);
    });
  });

  socket.on("music:seek", ({ roomCode, positionMs }) => {
    withErrorHandling(socket, async () => {
      const { session } = requireHost(roomCode);
      const m = session.music;
      if (!m.trackId) throw new InvalidActionError("No track is loaded.");
      const track = findTrack(m.trackId);
      m.positionMs = Math.max(0, Math.min(positionMs, track?.durationMs ?? positionMs));
      if (m.status === "playing") m.playbackStartEpoch = Date.now();
      syncMusicTimer(io, session);
      io.to(roomCode).emit("music:state", m);
    });
  });

  socket.on("music:shuffle", ({ roomCode, enabled }) => {
    withErrorHandling(socket, async () => {
      const { session } = requireHost(roomCode);
      const m = session.music;
      m.shuffle = enabled;
      const currentId = m.trackId;
      const baseIds = MUSIC_LIBRARY.map((t) => t.id);
      m.order = enabled ? shuffled(baseIds) : baseIds;
      m.index = currentId ? Math.max(0, m.order.indexOf(currentId)) : 0;
      syncMusicTimer(io, session);
      io.to(roomCode).emit("music:state", m);
    });
  });

  socket.on("music:repeat", ({ roomCode, mode }) => {
    withErrorHandling(socket, async () => {
      const { session } = requireHost(roomCode);
      session.music.repeat = mode;
      syncMusicTimer(io, session);
      io.to(roomCode).emit("music:state", session.music);
    });
  });
}
