"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Card as CardData, Seat, cardId } from "@/engine/types";
import { PlayingCard } from "@/components/cards/PlayingCard";
import { relativePosition, TablePosition } from "@/lib/seatLayout";
import { SUIT_META } from "@/lib/teamTheme";
import { cn } from "@/lib/utils";

interface TrickAreaProps {
  currentTrick: { seat: Seat; card: CardData }[];
  mySeat: Seat;
  trumpSuit?: string;
}

const POSITION_CLASSES: Record<TablePosition, string> = {
  bottom: "bottom-2 left-1/2 -translate-x-1/2",
  top: "top-2 left-1/2 -translate-x-1/2",
  left: "left-2 top-1/2 -translate-y-1/2",
  right: "right-2 top-1/2 -translate-y-1/2",
};

export function TrickArea({ currentTrick, mySeat, trumpSuit }: TrickAreaProps) {
  return (
    <div className="relative h-40 w-full max-w-xs sm:max-w-sm sm:h-48">
      <div className="absolute inset-0 rounded-full border border-white/10 bg-black/10" />

      {trumpSuit && (
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 text-white/30">
          <span className={cn("text-4xl", SUIT_META[trumpSuit].color, "opacity-60")}>{SUIT_META[trumpSuit].symbol}</span>
          <span className="text-[10px] uppercase tracking-widest">Trump</span>
        </div>
      )}

      <AnimatePresence>
        {currentTrick.map(({ seat, card }) => {
          const position = relativePosition(mySeat, seat);
          return (
            <motion.div
              key={cardId(card)}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              className={cn("absolute", POSITION_CLASSES[position])}
            >
              <PlayingCard layoutId={`hand-${cardId(card)}`} card={card} size="md" />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
