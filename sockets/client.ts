"use client";

import { io, Socket } from "socket.io-client";
import { ClientToServerEvents, ServerToClientEvents } from "./events";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

/**
 * Lazily creates (or returns) the single Socket.IO connection for this tab.
 * Reconnecting with a fresh token (e.g. after login) tears down the old
 * connection first so the server always sees the latest identity.
 */
export function getSocket(token: string): AppSocket {
  if (socket && socket.auth && (socket.auth as { token?: string }).token === token) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io({
    path: "/socket.io",
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 4000,
  });

  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
