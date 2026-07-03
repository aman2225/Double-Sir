"use client";

import { motion } from "framer-motion";
import { Card as CardData } from "@/engine/types";
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
}: PlayingCardProps) {
  const meta = SUIT_META[card.suit];
  const playable = !!onClick && !disabled;

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
      animate={selected ? { y: -16, scale: 1.03 } : { y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 26, mass: 0.6 }}
      className={cn(
        "relative shrink-0 select-none border bg-white flex flex-col justify-between p-1 font-semibold outline-none",
        SIZE_CLASSES[size],
        selected
          ? "border-primary ring-2 ring-primary shadow-[0_0_18px_rgba(250,204,21,0.35)]"
          : playable
          ? "border-black/10 shadow-md shadow-black/30 hover:shadow-lg hover:shadow-primary/20"
          : "border-black/10 shadow-md",
        disabled ? "opacity-50 grayscale-[40%]" : playable ? "cursor-grab active:cursor-grabbing" : "cursor-default",
        meta.faceColor,
        className
      )}
    >
      <span className="leading-none text-left">
        {card.rank}
        <br />
        {meta.symbol}
      </span>
      <span className="self-center text-2xl leading-none">{meta.symbol}</span>
      <span className="leading-none text-right rotate-180">
        {card.rank}
        <br />
        {meta.symbol}
      </span>
    </motion.button>
  );
}
