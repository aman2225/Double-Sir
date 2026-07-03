import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { GUEST_COOKIE_NAME, decodeGuestCookie, encodeGuestCookie, generateDeviceToken } from "@/lib/guestSession";
import { createGuestPlayerProfile, findPlayerProfileByGuestToken } from "@/lib/playerProfile";

const bodySchema = z.object({
  displayName: z.string().trim().min(1).max(24),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const existingToken = decodeGuestCookie(cookieStore.get(GUEST_COOKIE_NAME)?.value);

  if (existingToken) {
    const existingProfile = await findPlayerProfileByGuestToken(existingToken);
    if (existingProfile) {
      return NextResponse.json({ playerProfileId: existingProfile.id, displayName: existingProfile.displayName });
    }
  }

  const deviceToken = generateDeviceToken();
  const profile = await createGuestPlayerProfile(parsed.data.displayName, deviceToken);

  cookieStore.set(GUEST_COOKIE_NAME, encodeGuestCookie(deviceToken), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 180,
    path: "/",
  });

  return NextResponse.json({ playerProfileId: profile.id, displayName: profile.displayName });
}
