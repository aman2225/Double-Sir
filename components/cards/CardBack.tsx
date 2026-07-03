"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface CardBackProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  layoutId?: string;
}

const SIZE_CLASSES: Record<NonNullable<CardBackProps["size"]>, string> = {
  sm: "w-10 h-14 rounded-md",
  md: "w-16 h-22 rounded-lg",
  lg: "w-20 h-28 rounded-xl",
};

export function CardBack({ size = "md", className, layoutId }: CardBackProps) {
  return (
    <motion.div
      layoutId={layoutId}
      className={cn(
        "shrink-0 border-2 shadow-md",
        "border-[var(--gold,#d4af37)]/60 bg-gradient-to-br from-[var(--felt-deep,#0f2f22)] via-[var(--felt,#1f4a34)] to-[var(--felt-deep,#0f2f22)]",
        "bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.25)_1px,transparent_1px)] bg-[length:9px_9px]",
        "relative after:absolute after:inset-1 after:rounded-[inherit] after:border after:border-[var(--gold,#d4af37)]/25",
        SIZE_CLASSES[size],
        className
      )}
    />
  );
}
