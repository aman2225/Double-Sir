"use client";

import { AnimatePresence } from "framer-motion";
import { Card as CardData, cardId } from "@/engine/types";
import { PlayingCard } from "./PlayingCard";
import { useUIStore } from "@/store/useUIStore";
import { sounds } from "@/lib/sounds";
import { cn } from "@/lib/utils";

interface HandFanProps {
  cards: CardData[];
  legalCards: CardData[];
  isMyTurn: boolean;
  onPlay: (card: CardData) => void;
}

export function HandFan({ cards, legalCards, isMyTurn, onPlay }: HandFanProps) {
  const selectedCard = useUIStore((s) => s.selectedCard);
  const selectCard = useUIStore((s) => s.selectCard);
  const soundEnabled = useUIStore((s) => s.soundEnabled);
  const legalIds = new Set(legalCards.map(cardId));

  function handleCardClick(card: CardData) {
    if (!isMyTurn || !legalIds.has(cardId(card))) return;
    if (selectedCard && cardId(selectedCard) === cardId(card)) {
      selectCard(null);
      if (soundEnabled) sounds.cardPlay();
      onPlay(card);
      return;
    }
    if (soundEnabled) sounds.cardFlip();
    selectCard(card);
  }

  return (
    <div className="flex flex-col items-center gap-1 w-full">
      <div className="w-full overflow-x-auto overscroll-x-contain">
        <div
          className={cn(
            "flex justify-start sm:justify-center -space-x-10 sm:-space-x-6 md:-space-x-4 px-4 pb-1 pt-4 w-max mx-auto transition-opacity",
            !isMyTurn && "opacity-90"
          )}
        >
          <AnimatePresence initial={false}>
            {cards.map((card) => {
              const legal = legalIds.has(cardId(card));
              return (
                <PlayingCard
                  key={cardId(card)}
                  layoutId={`hand-${cardId(card)}`}
                  card={card}
                  size="md"
                  selected={!!selectedCard && cardId(selectedCard) === cardId(card)}
                  disabled={!isMyTurn || !legal}
                  onClick={isMyTurn && legal ? () => handleCardClick(card) : undefined}
                />
              );
            })}
          </AnimatePresence>
        </div>
      </div>
      <p className="h-4 text-xs text-muted-foreground">
        {isMyTurn ? (selectedCard ? "Tap again to play" : "Your turn — tap a card") : "Waiting for your turn..."}
      </p>
    </div>
  );
}
