// Short-lived signed token identifying a player to the Socket.IO server.
// Decouples realtime auth from Auth.js internals: the client fetches one of
// these from /api/session (which itself resolves either a next-auth
// session or a guest cookie) and hands it to the socket connection as
// `auth.token`. The socket server verifies the signature and expiry itself
// — no next-auth/session lookups on the hot realtime path.

import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export interface PlayerTokenPayload {
  playerProfileId: string;
  displayName: string;
  avatarUrl?: string;
  isGuest: boolean;
}

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set.");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function signPlayerToken(payload: PlayerTokenPayload): string {
  const body = JSON.stringify({ ...payload, exp: Date.now() + TOKEN_TTL_MS });
  const encoded = Buffer.from(body, "utf8").toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyPlayerToken(token: string | undefined | null): PlayerTokenPayload | null {
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const body = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (typeof body.exp !== "number" || Date.now() > body.exp) return null;
    return {
      playerProfileId: body.playerProfileId,
      displayName: body.displayName,
      avatarUrl: body.avatarUrl,
      isGuest: body.isGuest,
    };
  } catch {
    return null;
  }
}
