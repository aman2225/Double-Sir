"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Suit } from "@/engine/types";
import { SUIT_META } from "@/lib/teamTheme";
import { cn } from "@/lib/utils";
import { sounds } from "@/lib/sounds";
import { useUIStore } from "@/store/useUIStore";

const SUITS: Suit[] = ["SPADES", "HEARTS", "DIAMONDS", "CLUBS"];

interface TrumpPickerProps {
  open: boolean;
  declaredBid: number;
  onSelect: (suit: Suit) => void;
}

export function TrumpPicker({ open, declaredBid, onSelect }: TrumpPickerProps) {
  const soundEnabled = useUIStore((s) => s.soundEnabled);

  function handleSelect(suit: Suit) {
    if (soundEnabled) sounds.trumpSelect();
    onSelect(suit);
  }

  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false} className="border-[var(--gold)]/30 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[var(--gold)]">You won the bid at {declaredBid}!</DialogTitle>
          <DialogDescription>Choose the trump suit for this hand.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          {SUITS.map((suit) => {
            const meta = SUIT_META[suit];
            return (
              <button
                key={suit}
                onClick={() => handleSelect(suit)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border border-[var(--gold)]/20 bg-white/5 py-6 transition-all hover:scale-105 hover:border-[var(--gold)]/60 hover:bg-[var(--gold)]/10 hover:shadow-[0_0_20px_var(--gold-soft)] active:scale-95",
                  meta.color
                )}
              >
                <span className="text-4xl">{meta.symbol}</span>
                <span className="text-xs font-medium capitalize text-foreground">{suit.toLowerCase()}</span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
