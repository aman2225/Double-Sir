"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card as CardData, Suit } from "@/engine/types";
import { PlayingCard } from "@/components/cards/PlayingCard";
import { SUIT_META } from "@/lib/teamTheme";
import { cn } from "@/lib/utils";
import { sounds } from "@/lib/sounds";
import { useUIStore } from "@/store/useUIStore";

const SUITS: Suit[] = ["SPADES", "HEARTS", "DIAMONDS", "CLUBS"];

interface TrumpPickerProps {
  open: boolean;
  declaredBid: number;
  myHand?: CardData[];
  onSelect: (suit: Suit) => void;
}

export function TrumpPicker({ open, declaredBid, myHand = [], onSelect }: TrumpPickerProps) {
  const soundEnabled = useUIStore((s) => s.soundEnabled);

  function handleSelect(suit: Suit) {
    if (soundEnabled) sounds.trumpSelect();
    onSelect(suit);
  }

  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false} className="border-[var(--gold)]/30 bg-black/85 backdrop-blur-2xl sm:max-w-lg text-center">
        <DialogHeader className="items-center">
          <DialogTitle className="text-2xl font-black text-[var(--gold)]">Choose Trump Suit</DialogTitle>
          <DialogDescription className="text-white/80">
            You won the bid at <strong className="text-white">{declaredBid} hands</strong>! Select trump suit.
          </DialogDescription>
        </DialogHeader>

        {/* Trump Suit Selection Grid */}
        <div className="grid grid-cols-4 gap-2 py-3">
          {SUITS.map((suit) => {
            const meta = SUIT_META[suit];
            return (
              <button
                key={suit}
                onClick={() => handleSelect(suit)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-2xl border border-[var(--gold)]/20 bg-white/5 py-4 transition-all hover:scale-105 hover:border-[var(--gold)] hover:bg-[var(--gold)]/15 hover:shadow-[0_0_20px_var(--gold-soft)] active:scale-95",
                  meta.color
                )}
              >
                <span className="text-3xl">{meta.symbol}</span>
                <span className="text-xs font-bold capitalize text-foreground">{suit.toLowerCase()}</span>
              </button>
            );
          })}
        </div>

        {/* Player's First 5 Cards */}
        {myHand.length > 0 && (
          <div className="mt-2 space-y-2 border-t border-white/10 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-300/90">Your First 5 Cards</p>
            <div className="flex justify-center gap-1.5 sm:gap-2">
              {myHand.map((card, i) => (
                <PlayingCard key={card.rank + card.suit + i} card={card} size="responsive" />
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
