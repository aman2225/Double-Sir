-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('LOBBY', 'BIDDING', 'TRUMP_SELECT', 'PLAYING', 'HAND_COMPLETE', 'MATCH_COMPLETE', 'ABANDONED');

-- CreateEnum
CREATE TYPE "Team" AS ENUM ('A', 'B');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "googleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_profiles" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "deviceToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "guestProfileId" TEXT,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
    "matchesWon" INTEGER NOT NULL DEFAULT 0,
    "handsPlayed" INTEGER NOT NULL DEFAULT 0,
    "handsWon" INTEGER NOT NULL DEFAULT 0,
    "bidsWon" INTEGER NOT NULL DEFAULT 0,
    "bidsMade" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_rooms" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "RoomStatus" NOT NULL DEFAULT 'LOBBY',
    "hostProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_players" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "playerProfileId" TEXT NOT NULL,
    "seat" INTEGER NOT NULL,
    "team" "Team" NOT NULL,
    "connected" BOOLEAN NOT NULL DEFAULT true,
    "socketId" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "teamAPenalty" INTEGER NOT NULL DEFAULT 0,
    "teamBPenalty" INTEGER NOT NULL DEFAULT 0,
    "winningTeam" "Team",
    "dealerSeat" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hands" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "handNumber" INTEGER NOT NULL,
    "dealerSeat" INTEGER NOT NULL,
    "shuffleSeed" TEXT NOT NULL,
    "bidderSeat" INTEGER,
    "declaredBid" INTEGER,
    "trumpSuit" TEXT,
    "teamAHands" INTEGER NOT NULL DEFAULT 0,
    "teamBHands" INTEGER NOT NULL DEFAULT 0,
    "bidSuccess" BOOLEAN,
    "penaltyApplied" INTEGER,
    "penaltyTeam" "Team",
    "stateSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "hands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bids" (
    "id" TEXT NOT NULL,
    "handId" TEXT NOT NULL,
    "playerProfileId" TEXT NOT NULL,
    "seat" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "value" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tricks" (
    "id" TEXT NOT NULL,
    "handId" TEXT NOT NULL,
    "trickNumber" INTEGER NOT NULL,
    "leadSuit" TEXT NOT NULL,
    "winningSeat" INTEGER NOT NULL,
    "winningProfileId" TEXT,
    "cardsJson" JSONB NOT NULL,
    "streakPlayerSeat" INTEGER,
    "streakCount" INTEGER NOT NULL,
    "unclaimedHandsAfter" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tricks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "guest_profiles_deviceToken_key" ON "guest_profiles"("deviceToken");

-- CreateIndex
CREATE UNIQUE INDEX "player_profiles_userId_key" ON "player_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "player_profiles_guestProfileId_key" ON "player_profiles"("guestProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "game_rooms_code_key" ON "game_rooms"("code");

-- CreateIndex
CREATE UNIQUE INDEX "room_players_roomId_seat_key" ON "room_players"("roomId", "seat");

-- CreateIndex
CREATE UNIQUE INDEX "room_players_roomId_playerProfileId_key" ON "room_players"("roomId", "playerProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "hands_matchId_handNumber_key" ON "hands"("matchId", "handNumber");

-- CreateIndex
CREATE UNIQUE INDEX "tricks_handId_trickNumber_key" ON "tricks"("handId", "trickNumber");

-- AddForeignKey
ALTER TABLE "player_profiles" ADD CONSTRAINT "player_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_profiles" ADD CONSTRAINT "player_profiles_guestProfileId_fkey" FOREIGN KEY ("guestProfileId") REFERENCES "guest_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_players" ADD CONSTRAINT "room_players_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "game_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_players" ADD CONSTRAINT "room_players_playerProfileId_fkey" FOREIGN KEY ("playerProfileId") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "game_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hands" ADD CONSTRAINT "hands_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_handId_fkey" FOREIGN KEY ("handId") REFERENCES "hands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_playerProfileId_fkey" FOREIGN KEY ("playerProfileId") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tricks" ADD CONSTRAINT "tricks_handId_fkey" FOREIGN KEY ("handId") REFERENCES "hands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tricks" ADD CONSTRAINT "tricks_winningProfileId_fkey" FOREIGN KEY ("winningProfileId") REFERENCES "player_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
