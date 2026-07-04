"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Card as CardData, Seat, Suit, cardId } from "@/engine/types";
import { PlayingCard } from "@/components/cards/PlayingCard";
import { relativePosition, TablePosition } from "@/lib/seatLayout";
import { cn } from "@/lib/utils";

interface TrickAreaProps {
  currentTrick: { seat: Seat; card: CardData }[];
  mySeat: Seat;
  trumpSuit?: Suit;
  /** Seat that just won the displayed trick — its card gets a brief gold "winning card" glow. */
  winningSeat?: Seat;
  /** Seat info to show player name tags on played cards. */
  seatInfo?: Record<Seat, { displayName: string }>;
}

const POSITION_CLASSES: Record<TablePosition, string> = {
  bottom: "bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2",
  top: "top-2 sm:top-4 left-1/2 -translate-x-1/2",
  left: "left-8 sm:left-12 top-1/2 -translate-y-1/2",
  right: "right-8 sm:right-12 top-1/2 -translate-y-1/2",
};

export function TrickArea({ currentTrick, mySeat, trumpSuit, winningSeat }: TrickAreaProps) {
  return (
    <div className="relative h-52 w-64 sm:h-60 sm:w-96 md:h-68 md:w-[26rem] flex items-center justify-center mt-2 sm:mt-6">
      <div className="absolute inset-0 rounded-full border border-[var(--gold)]/15 bg-black/15 shadow-[inset_0_0_30px_rgba(0,0,0,0.4)]" />

      <AnimatePresence>
        {currentTrick.map(({ seat, card }) => {
          const position = relativePosition(mySeat, seat);

          return (
            <motion.div
              key={cardId(card)}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 450, damping: 22 }}
              className={cn("absolute flex flex-col items-center", POSITION_CLASSES[position])}
            >
              <PlayingCard
                layoutId={`hand-${cardId(card)}`}
                card={card}
                size="responsive"
                trumpSuit={trumpSuit}
                won={winningSeat === seat}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
