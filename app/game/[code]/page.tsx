"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useIdentity } from "@/hooks/useIdentity";
import { useGameStore } from "@/store/useGameStore";
import { GameTable, TableSeatInfo } from "@/components/game-table/GameTable";
import { HandFan } from "@/components/cards/HandFan";
import { BidPanel } from "@/components/bidding/BidPanel";
import { LiveBidTrack } from "@/components/bidding/LiveBidTrack";
import { TrumpPicker } from "@/components/bidding/TrumpPicker";
import { PenaltyBar } from "@/components/scoreboard/PenaltyBar";
import { StreakIndicator } from "@/components/scoreboard/StreakIndicator";
import { HandCompleteModal } from "@/components/match-end/HandCompleteModal";
import { GameOverScreen } from "@/components/match-end/GameOverScreen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Volume2, VolumeX } from "lucide-react";
import { SUIT_META } from "@/lib/teamTheme";
import { useUIStore } from "@/store/useUIStore";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { useCommsNotifications } from "@/hooks/useCommsNotifications";
import { useChatStore } from "@/store/useChatStore";
import { useVoiceStore } from "@/store/useVoiceStore";
import { CommsDock } from "@/components/comms/CommsDock";
import { EmojiQuickButton } from "@/components/comms/EmojiPicker";
import { MicState } from "@/components/game-table/PlayerSeat";
// Reusing the engine's own pure `legalPlays` helper (not reimplementing the
// rule) purely to highlight playable cards client-side. The server always
// re-validates every play independently — this is a display hint only.
import { legalPlays } from "@/engine/trick";
import { Card as CardData, Seat, SEATS, teamForSeat } from "@/engine/types";

export default function GamePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const roomCode = code.toUpperCase();
  const router = useRouter();
  const { player } = useIdentity();
  useSoundEffects();
  const soundEnabled = useUIStore((s) => s.soundEnabled);
  const toggleSound = useUIStore((s) => s.toggleSound);

  const connected = useGameStore((s) => s.connected);
  const roomState = useGameStore((s) => s.roomState);
  const gameState = useGameStore((s) => s.gameState);
  const lastTrickEvent = useGameStore((s) => s.lastTrickEvent);
  const lastHandComplete = useGameStore((s) => s.lastHandComplete);
  const lastMatchComplete = useGameStore((s) => s.lastMatchComplete);
  const lastError = useGameStore((s) => s.lastError);
  const clearError = useGameStore((s) => s.clearError);

  const joinRoom = useGameStore((s) => s.joinRoom);
  const leaveRoom = useGameStore((s) => s.leaveRoom);
  const placeBid = useGameStore((s) => s.placeBid);
  const selectTrump = useGameStore((s) => s.selectTrump);
  const playCard = useGameStore((s) => s.playCard);
  const continueHand = useGameStore((s) => s.continueHand);
  const playAgain = useGameStore((s) => s.playAgain);
  const newMatch = useGameStore((s) => s.newMatch);

  const [frozenTrick, setFrozenTrick] = useState<{ seat: Seat; card: CardData }[] | null>(null);
  const seenTrickKey = useRef<number | null>(null);
  const seenHandKey = useRef<number | null>(null);
  const joinAttempted = useRef(false);

  useEffect(() => {
    if (!player || !connected || joinAttempted.current) return;
    joinAttempted.current = true;
    joinRoom(roomCode, player.displayName);
  }, [player, connected, joinRoom, roomCode]);

  useEffect(() => {
    if (roomState && roomState.status === "LOBBY") {
      router.push(`/room/${roomCode}`);
    }
  }, [roomState, roomCode, router]);

  useEffect(() => {
    if (!lastError) return;
    toast.error(lastError);
    clearError();
  }, [lastError, clearError]);

  useEffect(() => {
    if (!lastTrickEvent || lastTrickEvent.key === seenTrickKey.current) return;
    seenTrickKey.current = lastTrickEvent.key;
    setFrozenTrick(lastTrickEvent.trick.cards);
    const timeout = setTimeout(() => setFrozenTrick(null), 1100);
    if (lastTrickEvent.handsCollected) {
      const { team, count } = lastTrickEvent.handsCollected;
      // A count of 1 while the streak is already established means this is
      // a hot-streak continuation (each trick captured instantly) rather
      // than the initial pool claim — a lighter, shorter toast for those.
      if (count === 1 && lastTrickEvent.streak.streakEstablished) {
        toast.success(`Team ${team} captures another trick! (streak ×${lastTrickEvent.streak.currentStreakCount})`, {
          duration: 1500,
        });
      } else {
        toast.success(`Team ${team} captures ${count} trick${count === 1 ? "" : "s"}!`);
      }
    }
    return () => clearTimeout(timeout);
  }, [lastTrickEvent]);

  useEffect(() => {
    if (!lastHandComplete || lastHandComplete.key === seenHandKey.current) return;
    seenHandKey.current = lastHandComplete.key;
  }, [lastHandComplete]);

  // Computed unconditionally (roomState may still be null) so the hook
  // below can be called before any early return — React hooks must run in
  // the same order every render.
  const notificationSeatNames: Record<Seat, string> = {} as Record<Seat, string>;
  for (const seat of SEATS) {
    notificationSeatNames[seat] = roomState?.players.find((p) => p.seat === seat)?.displayName ?? `Player ${seat}`;
  }
  useCommsNotifications(notificationSeatNames);

  const connectionState = useVoiceStore((s) => s.connectionState);
  const speakingSeats = useVoiceStore((s) => s.speakingSeats);
  const remoteMuted = useVoiceStore((s) => s.remoteMuted);
  const reactions = useChatStore((s) => s.reactions);
  const sendEmoji = useChatStore((s) => s.sendEmoji);

  if (!roomState || !gameState || !player) {
    return (
      <main className="flex flex-1 items-center justify-center bg-gradient-to-br from-background via-background to-primary/10">
        <p className="text-muted-foreground">Loading table...</p>
      </main>
    );
  }

  const me = roomState.players.find((p) => p.playerProfileId === player.playerProfileId);
  if (!me) {
    return (
      <main className="flex flex-1 items-center justify-center bg-gradient-to-br from-background via-background to-primary/10">
        <p className="text-muted-foreground">You are not seated in this room.</p>
      </main>
    );
  }
  const mySeat = me.seat;
  const isHost = roomState.hostPlayerProfileId === player.playerProfileId;

  const hand = gameState.currentHand;
  const phase = hand?.phase ?? "BIDDING";

  const seatInfo: Record<Seat, TableSeatInfo> = {} as Record<Seat, TableSeatInfo>;
  for (const seat of SEATS) {
    const roomPlayer = roomState.players.find((p) => p.seat === seat);
    const publicHand = hand?.players.find((p) => p.seat === seat);
    seatInfo[seat] = {
      seat,
      displayName: roomPlayer?.displayName ?? `Player ${seat}`,
      team: teamForSeat(seat),
      connected: roomPlayer?.connected ?? false,
      cardCount: publicHand?.cardCount ?? 0,
    };
  }
  const seatNames = notificationSeatNames;
  const otherSeats = SEATS.filter((s) => s !== mySeat);

  function micStateFor(seat: Seat): MicState | undefined {
    if (connectionState.get(seat) !== "connected") return undefined;
    if (speakingSeats.has(seat)) return "speaking";
    return remoteMuted.get(seat) ? "muted" : undefined;
  }
  const micStateBySeat: Partial<Record<Seat, MicState>> = {};
  for (const seat of otherSeats) micStateBySeat[seat] = micStateFor(seat);

  const myHand = hand?.players.find((p) => p.seat === mySeat)?.hand ?? [];
  const legalCards = phase === "PLAYING" ? legalPlays(myHand, hand?.leadSuit) : [];
  const isMyPlayTurn = phase === "PLAYING" && hand?.currentTurn === mySeat;
  const isMyBidTurn = phase === "BIDDING" && hand?.bidding.currentSeat === mySeat;
  const isMyTrumpPick = phase === "TRUMP_SELECTION" && hand?.bidding.highestBid?.seat === mySeat;

  const displayedTrick = frozenTrick ?? hand?.currentTrick ?? [];

  const bidderName = lastHandComplete ? seatNames[lastHandComplete.bidderSeat] : "";
  const showHandCompleteModal = phase === "COMPLETE" && !gameState.winningTeam && !!lastHandComplete;

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden bg-gradient-to-br from-emerald-950 via-background to-background">
      {/* HUD */}
      <div className="z-10 flex flex-col gap-2 border-b border-white/5 bg-black/20 px-3 py-2 backdrop-blur-xl sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {roomCode}
            </Badge>
            <span className="text-xs text-muted-foreground">Hand #{gameState.handNumber}</span>
            {hand?.trumpSuit && (
              <span className={`flex items-center gap-1 text-sm font-semibold ${SUIT_META[hand.trumpSuit].color}`}>
                {SUIT_META[hand.trumpSuit].symbol} Trump
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {phase !== "BIDDING" && hand && <StreakIndicator streak={hand.streak} seatNames={seatNames} />}
            <Button variant="ghost" size="icon" aria-label="Toggle sound" onClick={toggleSound}>
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
            <ThemeToggle />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <PenaltyBar team="A" penalty={gameState.teamAPenalty} />
          <PenaltyBar team="B" penalty={gameState.teamBPenalty} />
        </div>
        {phase === "BIDDING" && hand && (
          <div className="flex justify-center pt-1">
            <LiveBidTrack
              entries={hand.bidding.entries}
              currentSeat={hand.bidding.currentSeat}
              seatNames={seatNames}
              biddingComplete={hand.bidding.phase === "COMPLETE"}
            />
          </div>
        )}
      </div>

      {/* Table */}
      <GameTable
        mySeat={mySeat}
        seatInfo={seatInfo}
        dealerSeat={gameState.dealerSeat}
        currentTurn={hand?.currentTurn ?? mySeat}
        currentTrick={displayedTrick}
        trumpSuit={hand?.trumpSuit}
        biddingEntries={hand?.bidding.entries ?? []}
        biddingWinnerSeat={hand?.bidding.highestBid?.seat}
        phase={phase}
        micStateBySeat={micStateBySeat}
        reactions={reactions}
      />

      {/* My hand + bidding controls */}
      <div className="z-10 flex flex-col items-center gap-2 border-t border-white/5 bg-black/20 pb-3 backdrop-blur-xl">
        <AnimatePresence>
          {isMyBidTurn && hand && (
            <div className="w-full flex justify-center px-2 pt-2">
              <BidPanel mySeat={mySeat} highestBid={hand.bidding.highestBid} onBid={(value) => placeBid(roomCode, value)} />
            </div>
          )}
        </AnimatePresence>

        <div className="flex w-full items-end justify-center gap-2 px-2">
          <HandFan cards={myHand} legalCards={legalCards} isMyTurn={isMyPlayTurn} onPlay={(card) => playCard(roomCode, card)} />
          <EmojiQuickButton onSelect={(emoji) => sendEmoji(roomCode, emoji)} className="mb-6 h-9 w-9 shrink-0 rounded-full bg-white/10" />
        </div>
      </div>

      <CommsDock
        roomCode={roomCode}
        mySeat={mySeat}
        myPlayerProfileId={player.playerProfileId}
        otherSeats={otherSeats}
        seatNames={seatNames}
      />

      {isMyTrumpPick && hand?.bidding.highestBid && (
        <TrumpPicker open declaredBid={hand.bidding.highestBid.value} onSelect={(suit) => selectTrump(roomCode, suit)} />
      )}

      {showHandCompleteModal && lastHandComplete && (
        <HandCompleteModal
          event={lastHandComplete}
          bidderName={bidderName}
          isHost={isHost}
          isFinalHandOfMatch={false}
          onContinue={() => continueHand(roomCode)}
        />
      )}

      {gameState.winningTeam && (
        <GameOverScreen
          winningTeam={gameState.winningTeam}
          teamAPenalty={gameState.teamAPenalty}
          teamBPenalty={gameState.teamBPenalty}
          handsPlayed={lastMatchComplete?.handsPlayed ?? gameState.handNumber}
          isHost={isHost}
          onPlayAgain={() => playAgain(roomCode)}
          onNewMatch={() => newMatch(roomCode)}
          onReturnHome={() => {
            leaveRoom(roomCode);
            router.push("/");
          }}
        />
      )}
    </main>
  );
}
