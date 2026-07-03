// Server-side input validation for chat/emoji payloads. Client-side
// validation exists too (for immediate UX feedback) but is never trusted —
// these are the checks that actually gate what gets broadcast to a room.

import { EMOJI_REACTIONS } from "@/sockets/emojiEvents";

export const CHAT_MESSAGE_MAX_LENGTH = 300;

/**
 * Strips HTML tags/entities and control characters, collapses surrounding
 * whitespace, and enforces the max length. Returns null if the message is
 * empty after cleaning (caller should reject, not broadcast an empty
 * message).
 */
export function sanitizeChatMessage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;

  const withoutTags = raw.replace(/<[^>]*>/g, "");
  const withoutControlChars = withoutTags.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");
  const trimmed = withoutControlChars.trim().slice(0, CHAT_MESSAGE_MAX_LENGTH);

  return trimmed.length > 0 ? trimmed : null;
}

export function isAllowedEmoji(value: unknown): value is string {
  return typeof value === "string" && (EMOJI_REACTIONS as readonly string[]).includes(value);
}
