-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('SIGNUP_BONUS', 'MATCH_ENTRY', 'MATCH_VICTORY', 'REFUND', 'ADJUSTMENT');

-- AlterTable
ALTER TABLE "game_rooms" ADD COLUMN     "entryFee" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isPrivate" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "roomName" TEXT;

-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "entryFee" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "prizeAwarded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "prizePool" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "playerProfileId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 10000,
    "totalEarned" INTEGER NOT NULL DEFAULT 10000,
    "totalSpent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "playerProfileId" TEXT NOT NULL,
    "roomId" TEXT,
    "matchId" TEXT,
    "type" "WalletTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallets_playerProfileId_key" ON "wallets"("playerProfileId");

-- CreateIndex
CREATE INDEX "wallet_transactions_playerProfileId_createdAt_idx" ON "wallet_transactions"("playerProfileId", "createdAt");

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_playerProfileId_fkey" FOREIGN KEY ("playerProfileId") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
