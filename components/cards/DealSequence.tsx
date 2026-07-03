"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CardBack } from "./CardBack";
import { Seat, SEATS } from "@/engine/types";
import { relativePosition, TablePosition } from "@/lib/seatLayout";
import { sounds } from "@/lib/sounds";
import { useUIStore } from "@/store/useUIStore";

interface DealSequenceProps {
  /** Any value that changes once per new hand (e.g. handNumber) — a fresh value replays the animation. */
  trigger: number;
  mySeat: Seat;
}

const TARGET_OFFSET: Record<TablePosition, { x: number; y: number }> = {
  top: { x: 0, y: -170 },
  bottom: { x: 0, y: 170 },
  left: { x: -170, y: 0 },
  right: { x: 170, y: 0 },
};

const ROUNDS = 3;
const STAGGER_MS = 90;
const TOTAL_MS = 1500;

/**
 * Purely decorative dealing flourish — hand data has already arrived over
 * the socket by the time this plays. Card-back sprites fly from the center
 * "deck" to each seat's general direction, staggered in waves.
 */
export function DealSequence({ trigger, mySeat }: DealSequenceProps) {
  const [visible, setVisible] = useState(false);
  const seenTrigger = useRef<number | null>(null);

  useEffect(() => {
    if (trigger === seenTrigger.current) return;
    seenTrigger.current = trigger;
    setVisible(true);

    const timeouts: ReturnType<typeof setTimeout>[] = [];
    for (let round = 0; round < ROUNDS; round++) {
      timeouts.push(
        setTimeout(() => {
          if (useUIStore.getState().soundEnabled) sounds.deal();
        }, round * SEATS.length * STAGGER_MS)
      );
    }
    timeouts.push(setTimeout(() => setVisible(false), TOTAL_MS));
    return () => timeouts.forEach(clearTimeout);
  }, [trigger]);

  if (!visible) return null;

  const cards: { key: string; target: TablePosition; delaySeconds: number }[] = [];
  let i = 0;
  for (let round = 0; round < ROUNDS; round++) {
    for (const seat of SEATS) {
      cards.push({ key: `${round}-${seat}`, target: relativePosition(mySeat, seat), delaySeconds: (i * STAGGER_MS) / 1000 });
      i++;
    }
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <AnimatePresence>
        {cards.map(({ key, target, delaySeconds }) => {
          const offset = TARGET_OFFSET[target];
          return (
            <motion.div
              key={key}
              className="absolute"
              initial={{ x: 0, y: 0, opacity: 0, scale: 0.8 }}
              animate={{ x: offset.x, y: offset.y, opacity: [0, 1, 1, 0], scale: 1 }}
              transition={{ duration: 0.55, delay: delaySeconds, ease: "easeOut" }}
            >
              <CardBack size="sm" />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
