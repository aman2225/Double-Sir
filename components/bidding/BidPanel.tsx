"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MAX_BID, MIN_OPENING_BID, Seat } from "@/engine/types";
import { GLASS_PANEL, GOLD_GLOW } from "@/lib/tableTheme";
import { cn } from "@/lib/utils";

interface BidPanelProps {
  mySeat: Seat;
  highestBid?: { seat: Seat; value: number };
  onBid: (value: number | undefined) => void;
}

export function BidPanel({ mySeat, highestBid, onBid }: BidPanelProps) {
  const isPlayer1 = mySeat === 1;
  const minBid = isPlayer1 ? MIN_OPENING_BID : (highestBid?.value ?? MIN_OPENING_BID - 1) + 1;
  const options = Array.from({ length: MAX_BID - minBid + 1 }, (_, i) => minBid + i);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={cn("flex flex-col items-center gap-2 rounded-2xl p-3", GLASS_PANEL, GOLD_GLOW)}
    >
      <p className="text-xs font-medium text-muted-foreground">
        {isPlayer1 ? "You must open the bidding (7-13)" : `Bid higher than ${highestBid?.value ?? "the opening bid"}, or pass`}
      </p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {options.length === 0 ? (
          <span className="text-xs text-muted-foreground">No valid bids remain.</span>
        ) : (
          options.map((value) => (
            <Button
              key={value}
              size="sm"
              onClick={() => onBid(value)}
              className="border border-[var(--gold)]/40 bg-[var(--gold)]/15 font-semibold text-[var(--gold)] hover:bg-[var(--gold)]/30 hover:text-[var(--gold)]"
            >
              {value}
            </Button>
          ))
        )}
        {!isPlayer1 && (
          <Button size="sm" variant="outline" onClick={() => onBid(undefined)}>
            Pass
          </Button>
        )}
      </div>
    </motion.div>
  );
}
