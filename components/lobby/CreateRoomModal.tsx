"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Users, Trophy, Coins, Lock, Globe, Key, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ENTRY_FEE_TIERS } from "@/lib/coinEconomy";
import { cn } from "@/lib/utils";

interface CreateRoomModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletBalance: number;
  walletLoaded: boolean;
  connected: boolean;
  onCreateRoom: (params: {
    roomName: string;
    entryFee: number;
    targetPoints: number;
    isPrivate: boolean;
    inviteCode?: string;
  }) => void;
  isSubmitting: boolean;
}

const TARGET_POINT_OPTIONS = [
  { value: 53, label: "53 Points", isDefault: true },
  { value: 101, label: "101 Points" },
  { value: 151, label: "151 Points" },
  { value: 201, label: "201 Points" },
];

export function CreateRoomModal({
  open,
  onOpenChange,
  walletBalance,
  walletLoaded,
  connected,
  onCreateRoom,
  isSubmitting,
}: CreateRoomModalProps) {
  const [roomName, setRoomName] = useState("Double Sir Masters");
  const [isPrivate, setIsPrivate] = useState(true);
  const [inviteCode, setInviteCode] = useState(() => "DS" + Math.floor(1000 + Math.random() * 9000));
  const [entryFee, setEntryFee] = useState<number>(ENTRY_FEE_TIERS[0].entryFee);
  const [selectedTargetOption, setSelectedTargetOption] = useState<number | "custom">(53);
  const [customPointsInput, setCustomPointsInput] = useState("100");
  const [customError, setCustomError] = useState<string | null>(null);

  const activeTargetPoints =
    selectedTargetOption === "custom"
      ? parseInt(customPointsInput, 10) || 53
      : selectedTargetOption;

  function handleCustomPointsChange(val: string) {
    setCustomPointsInput(val);
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 20 || num > 500) {
      setCustomError("Custom target must be between 20 and 500 points.");
    } else {
      setCustomError(null);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedTargetOption === "custom") {
      const num = parseInt(customPointsInput, 10);
      if (isNaN(num) || num < 20 || num > 500) {
        setCustomError("Target points must be between 20 and 500.");
        return;
      }
    }
    onCreateRoom({
      roomName: roomName.trim() || "Double Sir Room",
      entryFee,
      targetPoints: activeTargetPoints,
      isPrivate,
      inviteCode: isPrivate ? inviteCode.trim().toUpperCase() : undefined,
    });
  }

  const canAfford = !walletLoaded || walletBalance >= entryFee;
  const isFormValid = connected && canAfford && !customError && !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="sm:max-w-lg border-[var(--gold)]/30 bg-card/95 backdrop-blur-2xl text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-bold bg-gradient-to-r from-amber-400 via-amber-200 to-yellow-500 bg-clip-text text-transparent">
            <Sparkles className="h-6 w-6 text-amber-400" /> Create Custom Room
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Configure match target points, entry fee, and privacy settings before launching.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          {/* Room Name */}
          <div className="space-y-1.5">
            <Label htmlFor="roomName" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Room Name
            </Label>
            <Input
              id="roomName"
              placeholder="e.g. Double Sir Masters"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              maxLength={32}
              className="bg-background/50 border-white/10 focus-visible:ring-[var(--gold)]"
            />
          </div>

          {/* Room Type: Public / Private */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Room Type</Label>
              <div className="flex rounded-lg border border-white/10 p-1 bg-background/40">
                <button
                  type="button"
                  onClick={() => setIsPrivate(false)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-all",
                    !isPrivate ? "bg-amber-500/20 text-amber-300 shadow" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Globe className="h-3.5 w-3.5" /> Public
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrivate(true)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-all",
                    isPrivate ? "bg-amber-500/20 text-amber-300 shadow" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Lock className="h-3.5 w-3.5" /> Private
                </button>
              </div>
            </div>

            {/* Invite Code (for Private rooms) */}
            <div className="space-y-1.5">
              <Label htmlFor="inviteCode" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Invite Code
              </Label>
              <div className="relative">
                <Input
                  id="inviteCode"
                  disabled={!isPrivate}
                  value={isPrivate ? inviteCode : "N/A"}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  maxLength={8}
                  className="font-mono tracking-widest uppercase bg-background/50 border-white/10 focus-visible:ring-[var(--gold)]"
                />
                {isPrivate && (
                  <Key className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                )}
              </div>
            </div>
          </div>

          {/* Target Penalty Points */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5 text-amber-400" /> Target Penalty Points
              </Label>
              <Badge variant="outline" className="font-mono text-xs text-amber-300 border-amber-500/30 bg-amber-500/10">
                Limit: {activeTargetPoints} pts
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {TARGET_POINT_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => {
                    setSelectedTargetOption(opt.value);
                    setCustomError(null);
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center rounded-xl border p-2 text-xs font-bold transition-all",
                    selectedTargetOption === opt.value
                      ? "border-[var(--gold)] bg-[var(--gold)]/15 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]"
                      : "border-white/10 bg-background/30 text-muted-foreground hover:border-white/20 hover:text-foreground"
                  )}
                >
                  <span>{opt.value}</span>
                  {opt.isDefault && <span className="text-[10px] font-normal text-amber-400/80">(Default)</span>}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setSelectedTargetOption("custom")}
                className={cn(
                  "col-span-1 flex flex-col items-center justify-center rounded-xl border p-2 text-xs font-bold transition-all sm:col-span-1",
                  selectedTargetOption === "custom"
                    ? "border-[var(--gold)] bg-[var(--gold)]/15 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]"
                    : "border-white/10 bg-background/30 text-muted-foreground hover:border-white/20 hover:text-foreground"
                )}
              >
                <span>Custom</span>
              </button>
            </div>

            {selectedTargetOption === "custom" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="pt-1 space-y-1"
              >
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={20}
                    max={500}
                    value={customPointsInput}
                    onChange={(e) => handleCustomPointsChange(e.target.value)}
                    placeholder="20 - 500"
                    className="bg-background/50 border-white/10 focus-visible:ring-[var(--gold)] font-mono"
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Points (20 - 500)</span>
                </div>
                {customError && <p className="text-xs text-destructive">{customError}</p>}
              </motion.div>
            )}
          </div>

          {/* Entry Fee Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5 text-amber-400" /> Entry Fee Tier
            </Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ENTRY_FEE_TIERS.map((tier) => {
                const selected = entryFee === tier.entryFee;
                const unaffordable = walletLoaded && walletBalance < tier.entryFee;
                return (
                  <button
                    type="button"
                    key={tier.entryFee}
                    disabled={unaffordable}
                    onClick={() => setEntryFee(tier.entryFee)}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-xl border p-2 text-xs transition-all",
                      selected
                        ? "border-[var(--gold)] bg-[var(--gold)]/15 font-bold text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]"
                        : unaffordable
                        ? "opacity-40 border-white/5 bg-background/20 cursor-not-allowed text-muted-foreground"
                        : "border-white/10 bg-background/30 text-muted-foreground hover:border-white/20 hover:text-foreground"
                    )}
                  >
                    <span className="font-semibold">{tier.label}</span>
                    <span className="text-[10px] text-amber-400/80">🪙 {tier.entryFee.toLocaleString()}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Max Players (Fixed: 4) */}
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4 text-sky-400" /> Maximum Players
            </div>
            <Badge variant="secondary" className="font-semibold bg-sky-500/20 text-sky-300 border-sky-500/30">
              4 Players (Fixed)
            </Badge>
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={!isFormValid}
            className="w-full font-bold bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-black shadow-lg shadow-amber-500/20"
          >
            {isSubmitting
              ? "Creating Room..."
              : `Create Room (${entryFee === 0 ? "Free Entry" : `${entryFee.toLocaleString()} Coins`})`}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
