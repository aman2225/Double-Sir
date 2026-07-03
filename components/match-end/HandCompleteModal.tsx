"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HandCompleteEvent } from "@/store/useGameStore";
import { TEAM_THEME } from "@/lib/teamTheme";
import { cn } from "@/lib/utils";

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

  return (
    <Dialog open={!isFinalHandOfMatch}>
      <DialogContent showCloseButton={false} className="sm:max-w-md text-center">
        <DialogHeader className="items-center">
          <DialogTitle className={cn("text-2xl", event.bidSuccess ? "text-emerald-400" : "text-destructive")}>
            Bid {event.bidSuccess ? "Successful" : "Failed"}
          </DialogTitle>
          <DialogDescription>
            {bidderName} ({biddingTheme.label}) bid {event.declaredBid}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-6 py-2">
          <div className="text-center">
            <p className={cn("text-2xl font-bold", TEAM_THEME.A.text)}>{event.teamAHands}</p>
            <p className="text-xs text-muted-foreground">Team A tricks</p>
          </div>
          <div className="text-center">
            <p className={cn("text-2xl font-bold", TEAM_THEME.B.text)}>{event.teamBHands}</p>
            <p className="text-xs text-muted-foreground">Team B tricks</p>
          </div>
        </div>

        <Badge variant="secondary" className={cn("mx-auto", penaltyTheme.text)}>
          {penaltyTheme.label} +{event.penaltyApplied} penalty
        </Badge>

        <div className="mt-2 flex items-center justify-center gap-6 text-sm">
          <span className={TEAM_THEME.A.text}>Team A: {event.teamAPenalty}</span>
          <span className={TEAM_THEME.B.text}>Team B: {event.teamBPenalty}</span>
        </div>

        {isHost ? (
          <Button className="mt-4 w-full" onClick={onContinue}>
            Continue to next hand
          </Button>
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">Waiting for the host to continue...</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
