"use client";

import { AnimatePresence } from "framer-motion";
import { Card as CardData, Suit, cardId } from "@/engine/types";
import { PlayingCard } from "./PlayingCard";
import { useUIStore } from "@/store/useUIStore";
import { sounds } from "@/lib/sounds";
import { cn } from "@/lib/utils";

interface HandFanProps {
  cards: CardData[];
  legalCards: CardData[];
  isMyTurn: boolean;
  onPlay: (card: CardData) => void;
  trumpSuit?: Suit;
}

// Dragging a card up at least this many pixels commits the play — a light
// flick is enough, matching how physical card games feel, while staying
// well clear of an accidental small nudge.
const DRAG_PLAY_THRESHOLD_PX = -70;

export function HandFan({ cards, legalCards, isMyTurn, onPlay, trumpSuit }: HandFanProps) {
  const selectedCard = useUIStore((s) => s.selectedCard);
  const selectCard = useUIStore((s) => s.selectCard);
  const soundEnabled = useUIStore((s) => s.soundEnabled);
  const legalIds = new Set(legalCards.map(cardId));

  function playCard(card: CardData) {
    selectCard(null);
    if (soundEnabled) sounds.cardPlay();
    onPlay(card);
  }

  function handleCardClick(card: CardData) {
    if (!isMyTurn || !legalIds.has(cardId(card))) return;
    playCard(card);
  }

  function handleDragEnd(card: CardData, offsetY: number) {
    if (!isMyTurn || !legalIds.has(cardId(card))) return;
    if (offsetY <= DRAG_PLAY_THRESHOLD_PX) playCard(card);
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
              const playable = isMyTurn && legal;
              return (
                <PlayingCard
                  key={cardId(card)}
                  layoutId={`hand-${cardId(card)}`}
                  card={card}
                  size="md"
                  selected={!!selectedCard && cardId(selectedCard) === cardId(card)}
                  disabled={!playable}
                  onClick={playable ? () => handleCardClick(card) : undefined}
                  draggable={playable}
                  onDragEnd={({ offsetY }) => handleDragEnd(card, offsetY)}
                  trumpSuit={trumpSuit}
                />
              );
            })}
          </AnimatePresence>
        </div>
      </div>
      <p className="h-4 text-xs text-muted-foreground">
        {isMyTurn ? "Your turn — tap a card to play" : "Waiting for your turn..."}
      </p>
    </div>
  );
}
