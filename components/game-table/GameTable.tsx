"use client";

import { PlayerSeat, MicState } from "./PlayerSeat";
import { TrickArea } from "./TrickArea";
import { FloatingEmojiLayer } from "@/components/comms/FloatingEmojiLayer";
import { FloatingReaction } from "@/store/useChatStore";
import { BidEntry, Card as CardData, Seat, SEATS, Suit, TeamId } from "@/engine/types";
import { relativePosition } from "@/lib/seatLayout";

export interface TableSeatInfo {
  seat: Seat;
  displayName: string;
  team: TeamId;
  connected: boolean;
  cardCount: number;
}

interface GameTableProps {
  mySeat: Seat;
  seatInfo: Record<Seat, TableSeatInfo>;
  dealerSeat: Seat;
  currentTurn: Seat;
  currentTrick: { seat: Seat; card: CardData }[];
  trumpSuit?: Suit;
  biddingEntries: BidEntry[];
  biddingWinnerSeat?: Seat;
  phase: "BIDDING" | "TRUMP_SELECTION" | "PLAYING" | "COMPLETE";
  micStateBySeat?: Partial<Record<Seat, MicState>>;
  onQuickEmoji?: (seat: Seat, emoji: string) => void;
  reactions?: FloatingReaction[];
}

export function GameTable({
  mySeat,
  seatInfo,
  dealerSeat,
  currentTurn,
  currentTrick,
  trumpSuit,
  biddingEntries,
  biddingWinnerSeat,
  phase,
  micStateBySeat,
  onQuickEmoji,
  reactions,
}: GameTableProps) {
  const otherSeats = SEATS.filter((s) => s !== mySeat);
  const topSeat = otherSeats.find((s) => relativePosition(mySeat, s) === "top")!;
  const leftSeat = otherSeats.find((s) => relativePosition(mySeat, s) === "left")!;
  const rightSeat = otherSeats.find((s) => relativePosition(mySeat, s) === "right")!;

  function bidLabelFor(seat: Seat): string | undefined {
    if (phase !== "BIDDING") return undefined;
    const entry = [...biddingEntries].reverse().find((e) => e.seat === seat);
    if (!entry) return undefined;
    return entry.value !== undefined ? `Bid ${entry.value}` : "Pass";
  }

  function renderSeat(seat: Seat) {
    const info = seatInfo[seat];
    return (
      <PlayerSeat
        displayName={info.displayName}
        team={info.team}
        position={relativePosition(mySeat, seat)}
        connected={info.connected}
        isDealer={seat === dealerSeat}
        isCurrentTurn={seat === currentTurn && phase !== "COMPLETE"}
        cardCount={info.cardCount}
        bidLabel={bidLabelFor(seat)}
        isBidWinner={phase !== "BIDDING" && seat === biddingWinnerSeat}
        micState={micStateBySeat?.[seat]}
        onQuickEmoji={onQuickEmoji ? (emoji) => onQuickEmoji(seat, emoji) : undefined}
      />
    );
  }

  return (
    <div className="relative flex w-full flex-1 items-center justify-center py-4">
      <div className="absolute left-1/2 top-2 -translate-x-1/2">{renderSeat(topSeat)}</div>
      <div className="absolute left-2 top-1/2 -translate-y-1/2 sm:left-6">{renderSeat(leftSeat)}</div>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 sm:right-6">{renderSeat(rightSeat)}</div>

      <TrickArea currentTrick={currentTrick} mySeat={mySeat} trumpSuit={trumpSuit} />
      {reactions && <FloatingEmojiLayer reactions={reactions} mySeat={mySeat} />}
    </div>
  );
}
