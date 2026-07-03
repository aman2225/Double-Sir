// Orchestrator: authenticates the connection, then hands off to one
// register*Handlers module per concern. Each module owns its own event
// bindings — and, where relevant, its own `disconnect` cleanup, since
// Socket.IO sockets are plain EventEmitters and every `on("disconnect", ...)`
// listener registered below fires (in registration order).
//
// Registration order matters here: registerVoiceHandlers's disconnect
// cleanup looks up the leaving seat via `session.seatForSocket(socket.id)`,
// which only works while `occupant.socketId` is still set. registerGameHandlers's
// disconnect cleanup is what clears `occupant.socketId` to undefined. Voice
// MUST therefore be registered (and thus fire) before game, or its lookup
// would find nothing.

import { verifyPlayerToken } from "@/lib/playerToken";
import { registerChatHandlers } from "./chatHandlers";
import { registerEmojiHandlers } from "./emojiHandlers";
import { registerGameHandlers } from "./gameHandlers";
import { registerMusicHandlers } from "./musicHandlers";
import { registerVoiceHandlers } from "./voiceHandlers";
import { AppServer, AppSocket } from "./types";

export function registerSocketHandlers(io: AppServer) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    const player = verifyPlayerToken(token);
    if (!player) {
      next(new Error("Unauthorized"));
      return;
    }
    socket.data.player = player;
    next();
  });

  io.on("connection", (socket: AppSocket) => {
    registerVoiceHandlers(io, socket);
    registerChatHandlers(io, socket);
    registerEmojiHandlers(io, socket);
    registerMusicHandlers(io, socket);
    registerGameHandlers(io, socket);
  });
}
