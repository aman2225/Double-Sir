"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MAX_BID, MIN_OPENING_BID, Seat } from "@/engine/types";

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
      className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-card/80 p-3 shadow-2xl backdrop-blur-xl"
    >
      <p className="text-xs font-medium text-muted-foreground">
        {isPlayer1 ? "You must open the bidding (7-13)" : `Bid higher than ${highestBid?.value ?? "the opening bid"}, or pass`}
      </p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {options.length === 0 ? (
          <span className="text-xs text-muted-foreground">No valid bids remain.</span>
        ) : (
          options.map((value) => (
            <Button key={value} size="sm" variant="secondary" onClick={() => onBid(value)}>
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
