"use client";

import { PlayerSeat, MicState, ConnectionQuality } from "./PlayerSeat";
import { TrickArea } from "./TrickArea";
import { TrumpDisplay } from "./TrumpDisplay";
import { DealSequence } from "@/components/cards/DealSequence";
import { FloatingEmojiLayer } from "@/components/comms/FloatingEmojiLayer";
import { FloatingReaction } from "@/store/useChatStore";
import { BidEntry, Card as CardData, Seat, SEATS, Suit, TeamId } from "@/engine/types";
import { relativePosition } from "@/lib/seatLayout";
import { FELT_SURFACE } from "@/lib/tableTheme";
import { cn } from "@/lib/utils";

export interface TableSeatInfo {
  seat: Seat;
  displayName: string;
  team: TeamId;
  connected: boolean;
  cardCount: number;
  /** Team's captured-hand total (the "Double Sir" streak mechanic only tracks captures per team, not per seat). */
  capturedHands?: number;
  /** Team's penalty point total. */
  penaltyPoints?: number;
  connectionQuality?: ConnectionQuality;
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
  /** Seat that just won the currently-displayed trick — brief gold glow on its card. */
  winningSeat?: Seat;
  /** Epoch ms when the active player's 30s turn expires (card-play turns only). */
  turnDeadline?: number | null;
  /** Changes once per new hand — replays the card-dealing flourish. */
  handNumber?: number;
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
  winningSeat,
  turnDeadline,
  handNumber,
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
    const isCurrentTurn = seat === currentTurn && phase !== "COMPLETE";
    return (
      <PlayerSeat
        displayName={info.displayName}
        team={info.team}
        position={relativePosition(mySeat, seat)}
        connected={info.connected}
        isDealer={seat === dealerSeat}
        isCurrentTurn={isCurrentTurn}
        cardCount={info.cardCount}
        bidLabel={bidLabelFor(seat)}
        isBidWinner={phase !== "BIDDING" && seat === biddingWinnerSeat}
        micState={micStateBySeat?.[seat]}
        onQuickEmoji={onQuickEmoji ? (emoji) => onQuickEmoji(seat, emoji) : undefined}
        isMe={seat === mySeat}
        turnDeadline={isCurrentTurn && phase === "PLAYING" ? turnDeadline : undefined}
        capturedHands={info.capturedHands}
        penaltyPoints={info.penaltyPoints}
        connectionQuality={info.connectionQuality}
      />
    );
  }

  return (
    <div
      className={cn(
        "relative m-2 flex w-full flex-1 items-center justify-center overflow-hidden rounded-[2.5rem] py-8 sm:m-4 min-h-[380px] sm:min-h-[440px]",
        FELT_SURFACE
      )}
    >
      {trumpSuit && phase !== "BIDDING" && <TrumpDisplay suit={trumpSuit} />}
      <div className="absolute left-1/2 top-1 sm:top-2 -translate-x-1/2">{renderSeat(topSeat)}</div>
      <div className="absolute left-3 top-1/2 -translate-y-1/2 sm:left-6">{renderSeat(leftSeat)}</div>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 sm:right-6">{renderSeat(rightSeat)}</div>

      <TrickArea
        currentTrick={currentTrick}
        mySeat={mySeat}
        trumpSuit={trumpSuit}
        winningSeat={winningSeat}
        seatInfo={seatInfo}
      />
      {reactions && <FloatingEmojiLayer reactions={reactions} mySeat={mySeat} />}
      {handNumber !== undefined && <DealSequence trigger={handNumber} mySeat={mySeat} />}
    </div>
  );
}
