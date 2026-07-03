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
}

const SIZE_CLASSES: Record<NonNullable<PlayingCardProps["size"]>, string> = {
  sm: "w-10 h-14 text-[10px] rounded-md",
  md: "w-16 h-22 text-sm rounded-lg",
  lg: "w-20 h-28 text-base rounded-xl",
};

export function PlayingCard({ card, size = "md", selected, disabled, onClick, className, layoutId }: PlayingCardProps) {
  const meta = SUIT_META[card.suit];

  return (
    <motion.button
      type="button"
      layoutId={layoutId}
      onClick={onClick}
      disabled={disabled || !onClick}
      whileHover={onClick && !disabled ? { y: -10 } : undefined}
      whileTap={onClick && !disabled ? { scale: 0.96 } : undefined}
      animate={selected ? { y: -14 } : { y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={cn(
        "relative shrink-0 select-none border bg-white shadow-md flex flex-col justify-between p-1 font-semibold",
        SIZE_CLASSES[size],
        selected ? "border-primary ring-2 ring-primary shadow-xl" : "border-black/10",
        disabled ? "opacity-60 grayscale-[30%]" : onClick ? "cursor-pointer" : "cursor-default",
        meta.color,
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
