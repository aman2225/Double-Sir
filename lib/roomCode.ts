import { customAlphabet } from "nanoid";

// Unambiguous uppercase alphabet (no 0/O/1/I) for room codes players read aloud or type.
const nanoidRoomCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

export function generateRoomCode(): string {
  return nanoidRoomCode();
}
