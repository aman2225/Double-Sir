import { Seat } from "@/engine/types";

/** The exact whitelisted reaction set — imported by both the server validator and the emoji-picker UI so they can never drift apart. */
export const EMOJI_REACTIONS = [
  "😀", "😁", "😂", "🤣", "😍", "😎", "🤔", "😡", "😭", "😱", "😴", "👏",
  "👍", "👎", "❤️", "💔", "🔥", "🎉", "🎊", "💯", "🚀", "🍀", "👑", "🃏",
] as const;

export type EmojiReaction = (typeof EMOJI_REACTIONS)[number];

export interface EmojiClientEvents {
  "emoji:send": (payload: { roomCode: string; emoji: string }) => void;
}

export interface EmojiServerEvents {
  /** `id` is a per-room monotonically increasing counter, used as the client-side animation key. */
  "emoji:received": (payload: { id: number; seat: Seat; emoji: string }) => void;
}
