// Bridges the User/GuestProfile identity tables to the single PlayerProfile
// every gameplay table (RoomPlayer, Bid, Trick) actually references, so the
// rest of the app never has to branch on "is this a guest or a real
// account". Every newly created PlayerProfile also gets a Wallet seeded
// with the starting coin balance, in the same transaction, so a
// wallet-less profile can never exist (see server/wallet.ts).

import { prisma } from "./prisma";
import { createWalletForProfile } from "@/server/wallet";

export async function ensurePlayerProfileForUser(user: { id: string; name: string; avatarUrl?: string | null }) {
  const existing = await prisma.playerProfile.findUnique({ where: { userId: user.id } });
  if (existing) return existing;

  return prisma.$transaction(async (tx) => {
    const profile = await tx.playerProfile.create({
      data: {
        userId: user.id,
        displayName: user.name,
        avatarUrl: user.avatarUrl ?? undefined,
      },
    });
    await createWalletForProfile(profile.id, tx);
    return profile;
  });
}

export async function createGuestPlayerProfile(displayName: string, deviceToken: string) {
  return prisma.$transaction(async (tx) => {
    const guestProfile = await tx.guestProfile.create({
      data: { displayName, deviceToken },
    });
    const profile = await tx.playerProfile.create({
      data: {
        guestProfileId: guestProfile.id,
        displayName,
      },
    });
    await createWalletForProfile(profile.id, tx);
    return profile;
  });
}

export async function findPlayerProfileByGuestToken(deviceToken: string) {
  const guestProfile = await prisma.guestProfile.findUnique({
    where: { deviceToken },
    include: { playerProfile: true },
  });
  return guestProfile?.playerProfile ?? null;
}
