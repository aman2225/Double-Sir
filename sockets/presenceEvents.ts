// Presence notifications. Lobby seat membership (joined/left) gets its own
// light events here; mid-game connection presence
// (player:disconnected/reconnected, in sockets/events.ts) and voice presence
// (voice:peer-joined/left, voice:mute-status, in sockets/voiceEvents.ts)
// already fully cover the rest of "presence" — this file just names the
// lobby-membership half so the client notification hook has a single,
// explicit set of events to subscribe to per event group.

import { Seat } from "@/engine/types";

export interface PresenceServerEvents {
  "player:joined": (payload: { seat: Seat; displayName: string }) => void;
  "player:left": (payload: { seat: Seat; displayName: string }) => void;
}
