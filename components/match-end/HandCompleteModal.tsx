"use client";

import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HandCompleteEvent } from "@/store/useGameStore";
import { TEAM_THEME } from "@/lib/teamTheme";
import { cn } from "@/lib/utils";
import { Zap, AlertTriangle, CheckCircle2, Flag } from "lucide-react";

interface HandCompleteModalProps {
  event: HandCompleteEvent;
  bidderName: string;
  isHost: boolean;
  isFinalHandOfMatch: boolean;
  onContinue: () => void;
}

export function HandCompleteModal({ event, bidderName, isHost, isFinalHandOfMatch, onContinue }: HandCompleteModalProps) {
  const biddingTheme = TEAM_THEME[event.biddingTeam];
  const penaltyTheme = TEAM_THEME[event.penaltyTeam];
  const isEarlyBreak = event.earlyBreak;

  return (
    <Dialog open={!isFinalHandOfMatch}>
      <DialogContent showCloseButton={false} className="sm:max-w-md text-center overflow-hidden border-white/10 bg-black/85 backdrop-blur-2xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="flex flex-col items-center gap-3"
        >
          {/* Header Badge for Early Break */}
          {isEarlyBreak && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 20 }}
            >
              <Badge variant="outline" className="flex items-center gap-1 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-300 border-amber-500/30 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                <Flag className="h-3.5 w-3.5" /> Early Game Termination
              </Badge>
            </motion.div>
          )}

          <DialogHeader className="items-center">
            <DialogTitle className={cn("flex items-center justify-center gap-2 text-2xl font-black tracking-tight sm:text-3xl", event.bidSuccess ? "text-emerald-400 drop-shadow-[0_0_20px_rgba(52,211,153,0.3)]" : "text-rose-500 drop-shadow-[0_0_20px_rgba(244,63,94,0.3)]")}>
              {isEarlyBreak ? (
                <>
                  🏁 {event.bidSuccess ? "Bid Completed!" : "Bid Failed!"}
                </>
              ) : (
                <>
                  {event.bidSuccess ? <CheckCircle2 className="h-7 w-7 text-emerald-400" /> : <AlertTriangle className="h-7 w-7 text-rose-500" />}
                  Bid {event.bidSuccess ? "Successful" : "Failed"}
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-white/70">
              {bidderName} ({biddingTheme.label}) declared bid of <span className="font-bold text-white">{event.declaredBid} hands</span>
            </DialogDescription>
          </DialogHeader>

          {/* Explanation Callout for Early Termination */}
          {isEarlyBreak && event.earlyBreakReason && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={cn(
                "w-full rounded-xl border p-3.5 text-sm font-medium leading-relaxed shadow-inner",
                event.bidSuccess
                  ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-200"
                  : "border-rose-500/30 bg-rose-950/40 text-rose-200"
              )}
            >
              <div className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider opacity-80 mb-1">
                <Zap className="h-3.5 w-3.5" /> Early Break Reason
              </div>
              <p className="text-sm font-semibold">{event.earlyBreakReason}</p>
              <p className="mt-1 text-xs opacity-75">Remaining tricks skipped as the hand outcome is decided.</p>
            </motion.div>
          )}

          {/* Hands Collected Breakdown */}
          <div className="flex w-full items-center justify-around rounded-xl border border-white/5 bg-white/5 py-3 px-4 shadow-inner">
            <div className="text-center">
              <p className={cn("text-3xl font-extrabold", TEAM_THEME.A.text)}>{event.teamAHands}</p>
              <p className="text-xs font-medium text-white/60">Team A Hands</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="text-center">
              <p className={cn("text-3xl font-extrabold", TEAM_THEME.B.text)}>{event.teamBHands}</p>
              <p className="text-xs font-medium text-white/60">Team B Hands</p>
            </div>
          </div>

          {/* Penalty Applied */}
          <Badge variant="secondary" className={cn("px-4 py-1.5 text-xs font-bold uppercase tracking-wide", penaltyTheme.text, "border border-current/20 bg-white/5")}>
            {penaltyTheme.label} +{event.penaltyApplied} Penalty Points
          </Badge>

          {/* Current Penalty Totals */}
          <div className="flex items-center justify-center gap-6 text-sm font-semibold text-white/80">
            <span className={TEAM_THEME.A.text}>Team A Score: {event.teamAPenalty} pts</span>
            <span className="opacity-40">•</span>
            <span className={TEAM_THEME.B.text}>Team B Score: {event.teamBPenalty} pts</span>
          </div>

          {/* Action Button */}
          {isHost ? (
            <Button className="mt-2 w-full font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]" onClick={onContinue}>
              Continue to Next Hand
            </Button>
          ) : (
            <p className="mt-2 text-xs font-medium text-white/50 animate-pulse">Waiting for host to prepare next hand...</p>
          )}
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
