import { randomBytes } from "node:crypto";
import { ChatMessage } from "@/sockets/chatEvents";
import { createChatBucket } from "./rateLimit";
import { requireSeated, withErrorHandling } from "./roomHelpers";
import { sanitizeChatMessage } from "./sanitize";
import { GameSession } from "./session";
import { AppServer, AppSocket } from "./types";

/** Replays recent room chat to one socket — called right after a successful room:join (both new-seat and reconnect branches) in gameHandlers.ts. */
export function sendChatHistory(socket: AppSocket, session: GameSession) {
  socket.emit("chat:history", { messages: session.chatHistory });
}

export function registerChatHandlers(io: AppServer, socket: AppSocket) {
  const player = socket.data.player;

  socket.on("chat:send", ({ roomCode, text }) => {
    withErrorHandling(socket, async () => {
      const { session, occupant } = requireSeated(roomCode, player.playerProfileId);

      socket.data.chatBucket ??= createChatBucket();
      if (!socket.data.chatBucket.consume()) return; // rate-limited: silent drop, no error spam

      const clean = sanitizeChatMessage(text);
      if (!clean) return;

      const message: ChatMessage = {
        id: randomBytes(8).toString("hex"),
        seat: occupant.seat,
        playerProfileId: occupant.playerProfileId,
        displayName: occupant.displayName,
        avatarUrl: occupant.avatarUrl,
        text: clean,
        sentAt: Date.now(),
      };

      session.addChatMessage(message);
      io.to(roomCode).emit("chat:message", message);
    });
  });
}
