import { NextResponse } from "next/server";
import { getCurrentPlayer } from "@/lib/currentPlayer";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const player = await getCurrentPlayer();
  if (!player) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const profile = await prisma.playerProfile.findUnique({ where: { id: player.playerProfileId } });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const roomPlayers = await prisma.roomPlayer.findMany({
    where: { playerProfileId: player.playerProfileId },
    include: {
      room: {
        include: {
          matches: {
            where: { endedAt: { not: null } },
            orderBy: { endedAt: "desc" },
            include: { hands: { orderBy: { handNumber: "asc" } } },
          },
        },
      },
    },
  });

  const matches = roomPlayers
    .flatMap((rp) =>
      rp.room.matches.map((match) => ({
        matchId: match.id,
        roomCode: rp.room.code,
        mySeat: rp.seat,
        myTeam: rp.team,
        teamAPenalty: match.teamAPenalty,
        teamBPenalty: match.teamBPenalty,
        winningTeam: match.winningTeam,
        handsPlayed: match.hands.length,
        startedAt: match.startedAt,
        endedAt: match.endedAt,
        won: match.winningTeam === rp.team,
      }))
    )
    .sort((a, b) => new Date(b.endedAt!).getTime() - new Date(a.endedAt!).getTime())
    .slice(0, 25);

  return NextResponse.json({
    stats: {
      matchesPlayed: profile.matchesPlayed,
      matchesWon: profile.matchesWon,
      handsPlayed: profile.handsPlayed,
      handsWon: profile.handsWon,
      bidsMade: profile.bidsMade,
      bidsWon: profile.bidsWon,
    },
    matches,
  });
}
