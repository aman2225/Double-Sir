import { createEmojiBucket } from "./rateLimit";
import { requireSeated, withErrorHandling } from "./roomHelpers";
import { isAllowedEmoji } from "./sanitize";
import { AppServer, AppSocket } from "./types";

export function registerEmojiHandlers(io: AppServer, socket: AppSocket) {
  const player = socket.data.player;

  socket.on("emoji:send", ({ roomCode, emoji }) => {
    withErrorHandling(socket, async () => {
      const { session, occupant } = requireSeated(roomCode, player.playerProfileId);
      if (!isAllowedEmoji(emoji)) return;

      socket.data.emojiBucket ??= createEmojiBucket();
      if (!socket.data.emojiBucket.consume()) return; // cooldown active: silent drop

      io.to(roomCode).emit("emoji:received", { id: session.nextEmojiId(), seat: occupant.seat, emoji });
    });
  });
}
