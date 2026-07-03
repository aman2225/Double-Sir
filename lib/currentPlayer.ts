import { cookies } from "next/headers";
import { auth } from "./auth";
import { GUEST_COOKIE_NAME, decodeGuestCookie } from "./guestSession";
import { findPlayerProfileByGuestToken } from "./playerProfile";

export interface CurrentPlayer {
  playerProfileId: string;
  displayName: string;
  avatarUrl?: string;
  isGuest: boolean;
}

/** Resolves the caller's identity from either an Auth.js session or a guest cookie — the single source of truth used by both REST routes and /api/session (which mints the Socket.IO token). */
export async function getCurrentPlayer(): Promise<CurrentPlayer | null> {
  const session = await auth();
  if (session?.user?.playerProfileId) {
    return {
      playerProfileId: session.user.playerProfileId,
      displayName: session.user.name ?? "Player",
      avatarUrl: session.user.image ?? undefined,
      isGuest: false,
    };
  }

  const cookieStore = await cookies();
  const deviceToken = decodeGuestCookie(cookieStore.get(GUEST_COOKIE_NAME)?.value);
  if (!deviceToken) return null;

  const profile = await findPlayerProfileByGuestToken(deviceToken);
  if (!profile) return null;

  return {
    playerProfileId: profile.id,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl ?? undefined,
    isGuest: true,
  };
}
