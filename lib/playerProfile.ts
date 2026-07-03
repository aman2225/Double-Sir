// Bridges the User/GuestProfile identity tables to the single PlayerProfile
// every gameplay table (RoomPlayer, Bid, Trick) actually references, so the
// rest of the app never has to branch on "is this a guest or a real
// account".

import { prisma } from "./prisma";

export async function ensurePlayerProfileForUser(user: { id: string; name: string; avatarUrl?: string | null }) {
  const existing = await prisma.playerProfile.findUnique({ where: { userId: user.id } });
  if (existing) return existing;

  return prisma.playerProfile.create({
    data: {
      userId: user.id,
      displayName: user.name,
      avatarUrl: user.avatarUrl ?? undefined,
    },
  });
}

export async function createGuestPlayerProfile(displayName: string, deviceToken: string) {
  const guestProfile = await prisma.guestProfile.create({
    data: { displayName, deviceToken },
  });

  return prisma.playerProfile.create({
    data: {
      guestProfileId: guestProfile.id,
      displayName,
    },
  });
}

export async function findPlayerProfileByGuestToken(deviceToken: string) {
  const guestProfile = await prisma.guestProfile.findUnique({
    where: { deviceToken },
    include: { playerProfile: true },
  });
  return guestProfile?.playerProfile ?? null;
}
