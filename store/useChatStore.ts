import { create } from "zustand";
import { AppSocket } from "@/sockets/client";
import { ChatMessage } from "@/sockets/chatEvents";
import { Seat } from "@/engine/types";

export interface FloatingReaction {
  id: number;
  seat: Seat;
  emoji: string;
}

const REACTION_LIFETIME_MS = 2500;
const CLIENT_EMOJI_COOLDOWN_MS = 2000;

interface ChatState {
  socket: AppSocket | null;
  messages: ChatMessage[];
  reactions: FloatingReaction[];
  lastEmojiSentAt: number;

  bindToSocket: (socket: AppSocket) => void;
  sendMessage: (roomCode: string, text: string) => void;
  sendEmoji: (roomCode: string, emoji: string) => void;
  removeReaction: (id: number) => void;
  clear: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  socket: null,
  messages: [],
  reactions: [],
  lastEmojiSentAt: 0,

  bindToSocket: (socket) => {
    socket.off("chat:message");
    socket.off("chat:history");
    socket.off("emoji:received");

    socket.on("chat:message", (message) => set((s) => ({ messages: [...s.messages, message] })));
    socket.on("chat:history", ({ messages }) => set({ messages }));
    socket.on("emoji:received", ({ id, seat, emoji }) => {
      set((s) => ({ reactions: [...s.reactions, { id, seat, emoji }] }));
      setTimeout(() => get().removeReaction(id), REACTION_LIFETIME_MS);
    });

    set({ socket });
  },

  sendMessage: (roomCode, text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    get().socket?.emit("chat:send", { roomCode, text: trimmed });
  },

  sendEmoji: (roomCode, emoji) => {
    // Fast local guard for immediate UI feedback — the server enforces the
    // real cooldown authoritatively regardless.
    const now = Date.now();
    if (now - get().lastEmojiSentAt < CLIENT_EMOJI_COOLDOWN_MS) return;
    set({ lastEmojiSentAt: now });
    get().socket?.emit("emoji:send", { roomCode, emoji });
  },

  removeReaction: (id) => set((s) => ({ reactions: s.reactions.filter((r) => r.id !== id) })),

  clear: () => set({ messages: [], reactions: [] }),
}));
