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
        "shrink-0 border border-white/20 shadow-md bg-gradient-to-br from-primary/80 via-primary to-primary/60",
        "bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.15)_1px,transparent_1px)] bg-[length:8px_8px]",
        SIZE_CLASSES[size],
        className
      )}
    />
  );
}
