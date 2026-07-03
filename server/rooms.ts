import { GameSession } from "./session";

/** Process-local room registry. A single custom Node server process (server.ts) owns all live rooms. */
const sessions = new Map<string, GameSession>();

export function createSession(session: GameSession): void {
  sessions.set(session.roomCode, session);
}

export function getSession(roomCode: string): GameSession | undefined {
  return sessions.get(roomCode.toUpperCase());
}

export function removeSession(roomCode: string): void {
  sessions.delete(roomCode.toUpperCase());
}

export function allSessions(): GameSession[] {
  return [...sessions.values()];
}
