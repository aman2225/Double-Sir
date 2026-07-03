// One-time (but safely re-runnable) backfill: creates a Wallet + a
// SIGNUP_BONUS WalletTransaction for every PlayerProfile that doesn't
// already have one. Needed because the coin economy migration only makes
// NEW PlayerProfile creations get a wallet (see lib/playerProfile.ts) —
// accounts created before this feature shipped have none yet.
//
// Naturally idempotent: only ever touches profiles with zero wallets, so
// running it again after some profiles are already backfilled is a no-op
// for those and only picks up any stragglers.
//
// Run with: node --env-file=.env scripts/backfillWallets.mjs

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const STARTING_BALANCE = 10000;

async function main() {
  const totalProfiles = await prisma.playerProfile.count();
  const withoutWallet = await prisma.playerProfile.findMany({
    where: { wallet: null },
    select: { id: true, displayName: true },
  });

  console.log(`Total player profiles: ${totalProfiles}`);
  console.log(`Profiles without a wallet: ${withoutWallet.length}`);

  let backfilled = 0;
  for (const profile of withoutWallet) {
    await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.create({
        data: {
          playerProfileId: profile.id,
          balance: STARTING_BALANCE,
          totalEarned: STARTING_BALANCE,
          totalSpent: 0,
        },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          playerProfileId: profile.id,
          type: "SIGNUP_BONUS",
          amount: STARTING_BALANCE,
          balanceAfter: STARTING_BALANCE,
          description: "Welcome bonus (backfilled)",
        },
      });
    });
    backfilled++;
    console.log(`  + ${profile.displayName} (${profile.id}) -> ${STARTING_BALANCE} coins`);
  }

  const finalWalletCount = await prisma.wallet.count();
  console.log(`\nBackfilled ${backfilled} wallet(s). Total wallets now: ${finalWalletCount} / ${totalProfiles} profiles.`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
