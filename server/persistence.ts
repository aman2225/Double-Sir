// Mirrors every state-changing gameplay event to Postgres via Prisma. The
// in-memory GameSession (server/session.ts) is the fast path used to drive
// live gameplay; these writes exist so match history, player stats, and
// crash-recovery snapshots are always up to date without being on the hot
// path for validating a move (validation happens purely in engine/, before
// any of these functions are ever called).

import { prisma } from "@/lib/prisma";
import { generateRoomCode } from "@/lib/roomCode";
import { Card, HandState, Seat, Suit, TeamId, teamForSeat } from "@/engine/types";
import { Prisma, Team } from "@prisma/client";

export async function createRoomInDb(hostProfileId: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode();
    try {
      const room = await prisma.gameRoom.create({
        data: { code, hostProfileId, status: "LOBBY" },
      });
      await prisma.roomPlayer.create({
        data: { roomId: room.id, playerProfileId: hostProfileId, seat: 1, team: "A" },
      });
      return room;
    } catch (err: unknown) {
      // Unique constraint collision on `code` — extremely unlikely with a
      // 6-char unambiguous alphabet, but retry rather than fail the request.
      if (isUniqueConstraintError(err)) continue;
      throw err;
    }
  }
  throw new Error("Failed to allocate a unique room code after several attempts.");
}

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "P2002";
}

export async function findRoomByCode(code: string) {
  return prisma.gameRoom.findUnique({ where: { code: code.toUpperCase() }, include: { players: true } });
}

export async function addRoomPlayer(roomId: string, seat: Seat, playerProfileId: string) {
  return prisma.roomPlayer.create({
    data: { roomId, seat, playerProfileId, team: teamForSeat(seat) as Team },
  });
}

export async function setRoomStatus(roomId: string, status: "LOBBY" | "BIDDING" | "TRUMP_SELECT" | "PLAYING" | "HAND_COMPLETE" | "MATCH_COMPLETE" | "ABANDONED") {
  return prisma.gameRoom.update({ where: { id: roomId }, data: { status } });
}

export async function setPlayerConnection(roomId: string, seat: number, connected: boolean, socketId: string | null) {
  return prisma.roomPlayer.updateMany({
    where: { roomId, seat },
    data: { connected, socketId: socketId ?? undefined },
  });
}

export async function createMatchInDb(roomId: string) {
  return prisma.match.create({ data: { roomId } });
}

export async function createHandInDb(matchId: string, handNumber: number, dealerSeat: number, shuffleSeed: string) {
  return prisma.hand.create({ data: { matchId, handNumber, dealerSeat, shuffleSeed } });
}

export async function recordBidInDb(handId: string, playerProfileId: string, seat: number, sequence: number, value: number | undefined) {
  return prisma.bid.create({ data: { handId, playerProfileId, seat, sequence, value: value ?? null } });
}

export async function recordTrumpSelection(handId: string, bidderSeat: number, declaredBid: number, trumpSuit: Suit) {
  return prisma.hand.update({ where: { id: handId }, data: { bidderSeat, declaredBid, trumpSuit } });
}

export async function recordTrickInDb(
  handId: string,
  trickNumber: number,
  leadSuit: Suit,
  winningSeat: number,
  winningProfileId: string | undefined,
  cards: { seat: Seat; card: Card }[],
  streakPlayerSeat: number | null,
  streakCount: number,
  unclaimedHandsAfter: number
) {
  return prisma.trick.create({
    data: {
      handId,
      trickNumber,
      leadSuit,
      winningSeat,
      winningProfileId,
      cardsJson: cards as unknown as Prisma.InputJsonValue,
      streakPlayerSeat: streakPlayerSeat ?? undefined,
      streakCount,
      unclaimedHandsAfter,
    },
  });
}

export async function snapshotHandState(handId: string, hand: HandState) {
  return prisma.hand.update({
    where: { id: handId },
    data: { stateSnapshot: hand as unknown as Prisma.InputJsonValue },
  });
}

export async function completeHandInDb(
  handId: string,
  fields: {
    teamAHands: number;
    teamBHands: number;
    bidSuccess: boolean;
    penaltyApplied: number;
    penaltyTeam: TeamId;
  }
) {
  return prisma.hand.update({
    where: { id: handId },
    data: {
      teamAHands: fields.teamAHands,
      teamBHands: fields.teamBHands,
      bidSuccess: fields.bidSuccess,
      penaltyApplied: fields.penaltyApplied,
      penaltyTeam: fields.penaltyTeam as Team,
      completedAt: new Date(),
    },
  });
}

export async function updateMatchPenalties(matchId: string, teamAPenalty: number, teamBPenalty: number) {
  return prisma.match.update({ where: { id: matchId }, data: { teamAPenalty, teamBPenalty } });
}

export async function completeMatchInDb(matchId: string, winningTeam: TeamId) {
  return prisma.match.update({
    where: { id: matchId },
    data: { winningTeam: winningTeam as Team, endedAt: new Date() },
  });
}

export async function bumpPlayerStatsForHand(playerProfileId: string, won: boolean) {
  return prisma.playerProfile.update({
    where: { id: playerProfileId },
    data: {
      handsPlayed: { increment: 1 },
      handsWon: won ? { increment: 1 } : undefined,
    },
  });
}

export async function bumpBidderStats(playerProfileId: string, bidSuccess: boolean) {
  return prisma.playerProfile.update({
    where: { id: playerProfileId },
    data: {
      bidsMade: { increment: 1 },
      bidsWon: bidSuccess ? { increment: 1 } : undefined,
    },
  });
}

export async function bumpPlayerStatsForMatch(playerProfileId: string, won: boolean) {
  return prisma.playerProfile.update({
    where: { id: playerProfileId },
    data: {
      matchesPlayed: { increment: 1 },
      matchesWon: won ? { increment: 1 } : undefined,
    },
  });
}
