"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TeamId } from "@/engine/types";
import { TEAM_THEME } from "@/lib/teamTheme";
import { cn } from "@/lib/utils";

interface GameOverScreenProps {
  winningTeam: TeamId;
  teamAPenalty: number;
  teamBPenalty: number;
  handsPlayed: number;
  isHost: boolean;
  /** Coins the viewer's own team received per winning player (0 if the room had no entry fee, or this seat lost). */
  prizePerWinner: number;
  /** Whether the local viewer was on the winning team. */
  won: boolean;
  onPlayAgain: () => void;
  onNewMatch: () => void;
  onReturnHome: () => void;
}

const FLOATING_COINS = Array.from({ length: 10 }, (_, i) => i);

export function GameOverScreen({
  winningTeam,
  teamAPenalty,
  teamBPenalty,
  handsPlayed,
  isHost,
  prizePerWinner,
  won,
  onPlayAgain,
  onNewMatch,
  onReturnHome,
}: GameOverScreenProps) {
  const losingTeam: TeamId = winningTeam === "A" ? "B" : "A";
  const winTheme = TEAM_THEME[winningTeam];
  const showPrize = prizePerWinner > 0 && won;

  useEffect(() => {
    const colors = winningTeam === "A" ? ["#fbbf24", "#f59e0b", "#ffffff"] : ["#38bdf8", "#0ea5e9", "#ffffff"];
    const duration = 2500;
    const end = Date.now() + duration;

    (function frame() {
      confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0 }, colors });
      confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }, [winningTeam]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      {showPrize && (
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          {FLOATING_COINS.map((i) => (
            <motion.span
              key={i}
              className="absolute bottom-0 text-2xl"
              style={{ left: `${5 + ((i * 9) % 90)}%` }}
              initial={{ y: 0, opacity: 0 }}
              animate={{ y: "-100vh", opacity: [0, 1, 1, 0] }}
              transition={{ duration: 2.2 + (i % 4) * 0.3, delay: i * 0.1, ease: "easeOut" }}
            >
              🪙
            </motion.span>
          ))}
        </div>
      )}
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
        <Card className="w-full max-w-md border-white/10 bg-card/80 backdrop-blur-2xl shadow-2xl text-center">
          <CardHeader className="items-center pt-8">
            <Trophy className={cn("h-14 w-14", winTheme.text)} />
            <CardTitle className="text-3xl">
              <span className={winTheme.text}>{winTheme.label}</span> Wins!
            </CardTitle>
            <p className="text-sm text-muted-foreground">{TEAM_THEME[losingTeam].label} reached the penalty limit.</p>
            {prizePerWinner > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 260, damping: 18 }}
                className={cn(
                  "mt-2 rounded-full border px-4 py-1.5 text-lg font-bold",
                  won
                    ? "border-[var(--gold,#facc15)]/50 bg-[var(--gold,#facc15)]/10 text-[var(--gold,#facc15)]"
                    : "border-white/10 bg-white/5 text-muted-foreground"
                )}
              >
                🪙 {won ? `+${prizePerWinner.toLocaleString()}` : "0"} Coins
              </motion.div>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-center gap-8">
              <div>
                <p className={cn("text-3xl font-bold", TEAM_THEME.A.text)}>{teamAPenalty}</p>
                <p className="text-xs text-muted-foreground">Team A penalty</p>
              </div>
              <div className="h-10 w-px bg-border" />
              <div>
                <p className={cn("text-3xl font-bold", TEAM_THEME.B.text)}>{teamBPenalty}</p>
                <p className="text-xs text-muted-foreground">Team B penalty</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{handsPlayed} hands played this match</p>

            <div className="flex flex-col gap-2">
              {isHost ? (
                <>
                  <Button size="lg" onClick={onPlayAgain}>
                    Play Again
                  </Button>
                  <Button size="lg" variant="secondary" onClick={onNewMatch}>
                    New Match
                  </Button>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Waiting for the host to start a new match...</p>
              )}
              <Button size="lg" variant="ghost" onClick={onReturnHome}>
                Return Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
