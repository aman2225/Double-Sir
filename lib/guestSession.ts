// Lightweight signed-cookie identity for Guest Mode — no password, just a
// device-bound token so a guest can refresh/reconnect and keep their seat.

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const GUEST_COOKIE_NAME = "guest_session";

function secret(): string {
  const s = process.env.GUEST_COOKIE_SECRET;
  if (!s) throw new Error("GUEST_COOKIE_SECRET is not set.");
  return s;
}

export function generateDeviceToken(): string {
  return randomBytes(24).toString("base64url");
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function encodeGuestCookie(deviceToken: string): string {
  return `${deviceToken}.${sign(deviceToken)}`;
}

/** Verifies a cookie value's HMAC signature and returns the embedded device token, or null if invalid/tampered. */
export function decodeGuestCookie(cookieValue: string | undefined): string | null {
  if (!cookieValue) return null;
  const [deviceToken, signature] = cookieValue.split(".");
  if (!deviceToken || !signature) return null;

  const expected = sign(deviceToken);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return deviceToken;
}
