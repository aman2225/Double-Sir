import { NextResponse } from "next/server";
import { getCurrentPlayer } from "@/lib/currentPlayer";
import { signPlayerToken } from "@/lib/playerToken";

export async function GET() {
  const player = await getCurrentPlayer();
  if (!player) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const token = signPlayerToken(player);
  return NextResponse.json({ ...player, token });
}
