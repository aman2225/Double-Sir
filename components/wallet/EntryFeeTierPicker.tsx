"use client";

import { motion } from "framer-motion";
import { ENTRY_FEE_TIERS } from "@/lib/coinEconomy";
import { cn } from "@/lib/utils";

const TIER_ACCENT: Record<string, string> = {
  beginner: "border-emerald-400/40 data-[selected=true]:border-emerald-400 data-[selected=true]:bg-emerald-400/10",
  intermediate: "border-amber-400/40 data-[selected=true]:border-amber-400 data-[selected=true]:bg-amber-400/10",
  pro: "border-red-400/40 data-[selected=true]:border-red-400 data-[selected=true]:bg-red-400/10",
  elite: "border-[var(--gold,#facc15)]/40 data-[selected=true]:border-[var(--gold,#facc15)] data-[selected=true]:bg-[var(--gold,#facc15)]/10",
};

const TIER_EMOJI: Record<string, string> = { beginner: "🟢", intermediate: "🟡", pro: "🔴", elite: "🏆" };

interface EntryFeeTierPickerProps {
  value: number;
  onChange: (entryFee: number) => void;
  balance: number;
}

export function EntryFeeTierPicker({ value, onChange, balance }: EntryFeeTierPickerProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {ENTRY_FEE_TIERS.map((tier) => {
        const affordable = balance >= tier.entryFee;
        const selected = value === tier.entryFee;
        return (
          <motion.button
            key={tier.id}
            type="button"
            whileTap={affordable ? { scale: 0.96 } : undefined}
            disabled={!affordable}
            data-selected={selected}
            onClick={() => onChange(tier.entryFee)}
            className={cn(
              "flex flex-col items-start gap-0.5 rounded-xl border bg-white/5 p-2.5 text-left transition-colors",
              TIER_ACCENT[tier.id],
              !affordable && "cursor-not-allowed opacity-40"
            )}
          >
            <span className="text-xs font-semibold">
              {TIER_EMOJI[tier.id]} {tier.label}
            </span>
            <span className="text-[11px] text-muted-foreground">Entry: {tier.entryFee.toLocaleString()} coins</span>
            <span className="text-[11px] text-muted-foreground">Pool: {(tier.entryFee * 4).toLocaleString()} coins</span>
            <span className="text-[11px] font-medium text-[var(--gold,#facc15)]">Win: +{(tier.entryFee * 2).toLocaleString()} each</span>
            {!affordable && <span className="text-[10px] text-red-400">Insufficient coins</span>}
          </motion.button>
        );
      })}
    </div>
  );
}
