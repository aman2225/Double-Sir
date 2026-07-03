// The ONLY code path allowed to mutate a Wallet's balance/totalEarned/
// totalSpent. Every mutation happens inside a Prisma transaction alongside
// an append-only WalletTransaction row (the full audit log — never
// updated or deleted). Clients never calculate or assert a balance; they
// only ever render what this module (via server/gameHandlers.ts and the
// REST routes in app/api/wallet/) tells them.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { prizePerWinner } from "@/lib/coinEconomy";

type TxClient = Prisma.TransactionClient;

const STARTING_BALANCE = 10000;

export class InsufficientCoinsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientCoinsError";
  }
}

/** Creates a Wallet + the initial SIGNUP_BONUS transaction for a brand-new PlayerProfile. Called from lib/playerProfile.ts's two profile-creation paths (guest + registered/OAuth). */
export async function createWalletForProfile(playerProfileId: string, tx: TxClient) {
  const wallet = await tx.wallet.create({
    data: { playerProfileId, balance: STARTING_BALANCE, totalEarned: STARTING_BALANCE, totalSpent: 0 },
  });
  await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      playerProfileId,
      type: "SIGNUP_BONUS",
      amount: STARTING_BALANCE,
      balanceAfter: STARTING_BALANCE,
      description: "Welcome bonus",
    },
  });
  return wallet;
}

export async function getWalletSnapshot(playerProfileId: string) {
  return prisma.wallet.findUnique({ where: { playerProfileId } });
}

/**
 * All-or-nothing: verifies every player has sufficient balance THEN debits
 * all of them in one transaction. If anyone is short, the whole call
 * throws InsufficientCoinsError and NOBODY is charged — this is what makes
 * "no coins deducted on failure" true without needing a separate refund
 * path for the normal case.
 */
export async function deductEntryFees(playerProfileIds: string[], entryFee: number, roomId: string, matchId: string): Promise<void> {
  if (entryFee <= 0) return;

  await prisma.$transaction(async (tx) => {
    const wallets = await tx.wallet.findMany({ where: { playerProfileId: { in: playerProfileIds } } });
    if (wallets.length !== playerProfileIds.length) {
      throw new Error("One or more seated players have no wallet — cannot start a paid match.");
    }
    for (const wallet of wallets) {
      if (wallet.balance < entryFee) {
        throw new InsufficientCoinsError("One or more players do not have enough coins to start this match.");
      }
    }
    for (const wallet of wallets) {
      const balanceAfter = wallet.balance - entryFee;
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter, totalSpent: { increment: entryFee } },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          playerProfileId: wallet.playerProfileId,
          roomId,
          matchId,
          type: "MATCH_ENTRY",
          amount: -entryFee,
          balanceAfter,
          description: "Match entry fee",
        },
      });
    }
  });
}

/** Compensating transaction for the one real failure window: entry fees were deducted but match-row creation then threw for an unrelated reason. */
export async function refundEntryFees(playerProfileIds: string[], entryFee: number, roomId: string, matchId: string): Promise<void> {
  if (entryFee <= 0) return;

  await prisma.$transaction(async (tx) => {
    const wallets = await tx.wallet.findMany({ where: { playerProfileId: { in: playerProfileIds } } });
    for (const wallet of wallets) {
      const balanceAfter = wallet.balance + entryFee;
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter, totalSpent: { decrement: entryFee } },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          playerProfileId: wallet.playerProfileId,
          roomId,
          matchId,
          type: "REFUND",
          amount: entryFee,
          balanceAfter,
          description: "Match entry fee refund",
        },
      });
    }
  });
}

/**
 * Credits the prize to the winning team's 2 players. Guarded by a
 * conditional update on Match.prizeAwarded — if another call already paid
 * this match out, `updateMany`'s count is 0 and this is a complete no-op,
 * which is the at-most-once guarantee the security section asks for
 * ("prevent duplicate rewards"), enforced at the DB level.
 */
export interface WalletBalanceSnapshot {
  balance: number;
  totalEarned: number;
  totalSpent: number;
}

export async function creditMatchPrize(
  winnerPlayerProfileIds: string[],
  entryFee: number,
  roomId: string,
  matchId: string
): Promise<Map<string, WalletBalanceSnapshot>> {
  const result = new Map<string, WalletBalanceSnapshot>();
  if (entryFee <= 0 || winnerPlayerProfileIds.length === 0) return result;

  await prisma.$transaction(async (tx) => {
    const guard = await tx.match.updateMany({ where: { id: matchId, prizeAwarded: false }, data: { prizeAwarded: true } });
    if (guard.count === 0) return; // already paid out — no-op

    const perWinner = prizePerWinner(entryFee);
    const wallets = await tx.wallet.findMany({ where: { playerProfileId: { in: winnerPlayerProfileIds } } });
    for (const wallet of wallets) {
      const balanceAfter = wallet.balance + perWinner;
      const totalEarnedAfter = wallet.totalEarned + perWinner;
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter, totalEarned: { increment: perWinner } },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          playerProfileId: wallet.playerProfileId,
          roomId,
          matchId,
          type: "MATCH_VICTORY",
          amount: perWinner,
          balanceAfter,
          description: "Match victory prize",
        },
      });
      result.set(wallet.playerProfileId, { balance: balanceAfter, totalEarned: totalEarnedAfter, totalSpent: wallet.totalSpent });
    }
  });

  return result;
}
