"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Seat } from "@/engine/types";
import { FloatingReaction } from "@/store/useChatStore";
import { relativePosition, TablePosition } from "@/lib/seatLayout";
import { cn } from "@/lib/utils";

const POSITION_CLASSES: Record<TablePosition, string> = {
  bottom: "bottom-4 left-1/2 -translate-x-1/2",
  top: "top-4 left-1/2 -translate-x-1/2",
  left: "left-4 top-1/3",
  right: "right-4 top-1/3",
};

/** Mounted once over the game table — floats each incoming emoji reaction up from the correct seat's position, auto-removed by the store after ~2.5s. */
export function FloatingEmojiLayer({ reactions, mySeat }: { reactions: FloatingReaction[]; mySeat: Seat }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      <AnimatePresence>
        {reactions.map((reaction) => {
          const position = relativePosition(mySeat, reaction.seat);
          return (
            <motion.div
              key={reaction.id}
              initial={{ opacity: 0, y: 0, scale: 0.5 }}
              animate={{ opacity: [0, 1, 1, 0], y: -80, scale: 1.3 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.3, ease: "easeOut" }}
              className={cn("absolute z-20 text-4xl drop-shadow-lg", POSITION_CLASSES[position])}
            >
              {reaction.emoji}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
