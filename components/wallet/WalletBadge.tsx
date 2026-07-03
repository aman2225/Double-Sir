"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sheet, SheetTrigger } from "@/components/ui/sheet";
import { useWalletStore } from "@/store/useWalletStore";
import { WalletPanel } from "./WalletPanel";
import { cn } from "@/lib/utils";

interface WalletBadgeProps {
  className?: string;
}

export function WalletBadge({ className }: WalletBadgeProps) {
  const balance = useWalletStore((s) => s.balance);
  const loaded = useWalletStore((s) => s.loaded);
  const fetchWallet = useWalletStore((s) => s.fetchWallet);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loaded) fetchWallet();
  }, [loaded, fetchWallet]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <button
            type="button"
            className={cn(
              "fixed left-3 top-3 z-50 flex items-center gap-1.5 rounded-full border border-[var(--gold,#facc15)]/30 bg-black/40 px-3 py-1.5 text-sm font-semibold text-[var(--gold,#facc15)] backdrop-blur-xl transition-transform hover:scale-105 active:scale-95",
              className
            )}
            aria-label="Open wallet"
          />
        }
      >
        <span className="text-base leading-none">🪙</span>
        <AnimatePresence mode="wait">
          <motion.span
            key={balance}
            initial={{ y: -6, opacity: 0, scale: 1.15 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            className="tabular-nums"
          >
            {loaded ? balance.toLocaleString() : "..."}
          </motion.span>
        </AnimatePresence>
      </SheetTrigger>
      <WalletPanel />
    </Sheet>
  );
}
