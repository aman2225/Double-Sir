"use client";

import { motion } from "framer-motion";
import { Card as CardData, Suit } from "@/engine/types";
import { SUIT_META } from "@/lib/teamTheme";
import { cn } from "@/lib/utils";

interface PlayingCardProps {
  card: CardData;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  layoutId?: string;
  /** Enables Framer Motion drag — see components/cards/HandFan.tsx for the drag-to-play gesture. */
  draggable?: boolean;
  onDragEnd?: (info: { offsetY: number }) => void;
  /** Current hand's trump suit — draws a gold ring/corner mark when this card matches it. */
  trumpSuit?: Suit;
  /** This card just won its trick — brief bright gold glow + lift. */
  won?: boolean;
}

const SIZE_CLASSES: Record<NonNullable<PlayingCardProps["size"]>, string> = {
  sm: "w-10 h-14 text-[10px] rounded-md",
  md: "w-16 h-22 text-sm rounded-lg",
  lg: "w-20 h-28 text-base rounded-xl",
};

export function PlayingCard({
  card,
  size = "md",
  selected,
  disabled,
  onClick,
  className,
  layoutId,
  draggable,
  onDragEnd,
  trumpSuit,
  won,
}: PlayingCardProps) {
  const meta = SUIT_META[card.suit];
  const playable = !!onClick && !disabled;
  const isTrump = trumpSuit === card.suit;

  return (
    <motion.button
      type="button"
      layoutId={layoutId}
      onClick={onClick}
      disabled={disabled || !onClick}
      drag={draggable ? "y" : false}
      dragSnapToOrigin
      dragElastic={0.15}
      dragConstraints={{ top: -140, bottom: 0 }}
      onDragEnd={(_, info) => onDragEnd?.({ offsetY: info.offset.y })}
      whileHover={playable ? { y: -12, scale: 1.04 } : undefined}
      whileTap={playable ? { scale: 0.95 } : undefined}
      whileDrag={{ scale: 1.08, zIndex: 50, cursor: "grabbing" }}
      animate={
        won
          ? { y: -10, scale: 1.08 }
          : selected
          ? { y: -16, scale: 1.03 }
          : { y: 0, scale: 1 }
      }
      transition={{ type: "spring", stiffness: 380, damping: 26, mass: 0.6 }}
      className={cn(
        "relative shrink-0 select-none border bg-gradient-to-br from-white to-slate-100 flex flex-col justify-between p-1 font-semibold outline-none overflow-hidden",
        SIZE_CLASSES[size],
        won
          ? "border-[var(--gold,#facc15)] ring-2 ring-[var(--gold,#facc15)] shadow-[0_0_28px_rgba(250,204,21,0.65)]"
          : selected
          ? "border-primary ring-2 ring-primary shadow-[0_0_18px_rgba(250,204,21,0.35)]"
          : isTrump
          ? "border-[var(--gold,#facc15)]/70 shadow-[0_0_10px_rgba(250,204,21,0.3)]"
          : playable
          ? "border-black/10 shadow-md shadow-black/30 hover:shadow-lg hover:shadow-primary/20"
          : "border-black/10 shadow-md",
        disabled ? "opacity-50 grayscale-[40%]" : playable ? "cursor-grab active:cursor-grabbing" : "cursor-default",
        meta.faceColor,
        className
      )}
    >
      {/* Gloss overlay — diagonal highlight sweep, purely decorative. */}
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/70 via-transparent to-transparent opacity-60" />

      {isTrump && (
        <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--gold,#facc15)] shadow-[0_0_4px_rgba(250,204,21,0.8)]" />
      )}

      <span className="relative leading-none text-left">
        {card.rank}
        <br />
        {meta.symbol}
      </span>
      <span className="relative self-center text-2xl leading-none">{meta.symbol}</span>
      <span className="relative leading-none text-right rotate-180">
        {card.rank}
        <br />
        {meta.symbol}
      </span>
    </motion.button>
  );
}
