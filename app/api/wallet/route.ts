import { NextResponse } from "next/server";
import { getCurrentPlayer } from "@/lib/currentPlayer";
import { prisma } from "@/lib/prisma";

/**
 * Wallet snapshot — deliberately a plain REST GET (not a socket event) so
 * the wallet badge works on any page, including before a room/socket
 * connection exists (e.g. the home page). Realtime balance deltas while
 * already connected arrive separately via the "wallet:balance" socket
 * event (see server/gameHandlers.ts).
 */
export async function GET() {
  const player = await getCurrentPlayer();
  if (!player) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const [wallet, profile] = await Promise.all([
    prisma.wallet.findUnique({ where: { playerProfileId: player.playerProfileId } }),
    prisma.playerProfile.findUnique({ where: { id: player.playerProfileId } }),
  ]);

  if (!wallet || !profile) {
    return NextResponse.json({ error: "Wallet not found." }, { status: 404 });
  }

  return NextResponse.json({
    balance: wallet.balance,
    totalEarned: wallet.totalEarned,
    totalSpent: wallet.totalSpent,
    matchesPlayed: profile.matchesPlayed,
    matchesWon: profile.matchesWon,
  });
}
