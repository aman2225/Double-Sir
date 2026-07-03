// Shared server-side Socket.IO types. Split out from socketHandlers.ts so
// every handler module (game/chat/voice/emoji) can import them without a
// circular dependency back through the orchestrator file.

import type { Server, Socket } from "socket.io";
import { PlayerTokenPayload } from "@/lib/playerToken";
import { ClientToServerEvents, ServerToClientEvents } from "@/sockets/events";
import { TokenBucket } from "./rateLimit";

export interface SocketData {
  player: PlayerTokenPayload;
  // Rate-limit buckets are created lazily, on each socket's first use of
  // that event group — see server/rateLimit.ts.
  chatBucket?: TokenBucket;
  emojiBucket?: TokenBucket;
  signalingBucket?: TokenBucket;
}

export type AppServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
export type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
