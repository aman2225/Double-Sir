// Server-authoritative auto-advance-on-track-end for room music.
// Architecturally identical to server/turnTimer.ts: clear the existing
// timeout, compute how much time is actually left on the current track
// from the position/epoch anchor, and arm a fresh setTimeout for exactly
// that long. Called at the end of every mutating handler in
// server/musicHandlers.ts (play/pause/resume/stop/next/previous/
// selectTrack/seek/shuffle/repeat) — piggybacking on those call sites
// instead of a parallel state machine, same discipline as the turn timer.

import { findTrack } from "@/lib/musicLibrary";
import { GameSession } from "./session";
import { AppServer } from "./types";

export function syncMusicTimer(io: AppServer, session: GameSession) {
  if (session.musicTimer) {
    clearTimeout(session.musicTimer);
    session.musicTimer = undefined;
  }

  const m = session.music;
  if (m.status !== "playing" || !m.trackId || m.playbackStartEpoch === undefined) return;

  const track = findTrack(m.trackId);
  if (!track) return;

  const elapsedSincePlaying = Date.now() - m.playbackStartEpoch;
  const remaining = track.durationMs - (m.positionMs + elapsedSincePlaying);

  session.musicTimer = setTimeout(() => handleTrackEnd(io, session), Math.max(0, remaining));
}

function handleTrackEnd(io: AppServer, session: GameSession) {
  const m = session.music;
  if (m.status !== "playing") return;

  if (m.repeat === "one") {
    m.positionMs = 0;
    m.playbackStartEpoch = Date.now();
  } else {
    const hasNext = m.index < m.order.length - 1;
    if (hasNext) {
      m.index += 1;
    } else if (m.repeat === "all" && m.order.length > 0) {
      m.index = 0;
    } else {
      m.status = "stopped";
      m.trackId = null;
      m.positionMs = 0;
      m.playbackStartEpoch = undefined;
      io.to(session.roomCode).emit("music:state", m);
      return;
    }
    m.trackId = m.order[m.index];
    m.positionMs = 0;
    m.playbackStartEpoch = Date.now();
  }

  syncMusicTimer(io, session);
  io.to(session.roomCode).emit("music:state", m);
}
