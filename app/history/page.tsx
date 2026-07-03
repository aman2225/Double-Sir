"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useIdentity } from "@/hooks/useIdentity";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TEAM_THEME } from "@/lib/teamTheme";
import { cn } from "@/lib/utils";

interface HistoryStats {
  matchesPlayed: number;
  matchesWon: number;
  handsPlayed: number;
  handsWon: number;
  bidsMade: number;
  bidsWon: number;
}

interface HistoryMatch {
  matchId: string;
  roomCode: string;
  mySeat: number;
  myTeam: "A" | "B";
  teamAPenalty: number;
  teamBPenalty: number;
  winningTeam: "A" | "B" | null;
  handsPlayed: number;
  startedAt: string;
  endedAt: string;
  won: boolean;
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export default function HistoryPage() {
  const { player, status } = useIdentity();
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [matches, setMatches] = useState<HistoryMatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!player) return;
    fetch("/api/history")
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load history.");
        return res.json();
      })
      .then((data) => {
        setStats(data.stats);
        setMatches(data.matches);
      })
      .catch((err) => setError(err.message));
  }, [player]);

  return (
    <main className="flex flex-1 flex-col bg-gradient-to-br from-background via-background to-primary/10 p-4 sm:p-8">
      <ThemeToggle className="fixed right-3 top-3 z-50" />
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto w-full max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" nativeButton={false} render={<Link href="/" />}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Match History</h1>
        </div>

        {status === "ready" && !player ? (
          <Card className="border-white/10 bg-card/60 backdrop-blur-xl">
            <CardContent className="py-10 text-center text-muted-foreground">
              Sign in or play as a guest to see your match history.
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="border-white/10 bg-card/60 backdrop-blur-xl">
            <CardContent className="py-10 text-center text-destructive">{error}</CardContent>
          </Card>
        ) : !stats || !matches ? (
          <Card className="border-white/10 bg-card/60 backdrop-blur-xl">
            <CardContent className="py-10 text-center text-muted-foreground">Loading...</CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-white/10 bg-card/60 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-base">Your Stats</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-3">
                <StatTile label="Matches Won" value={`${stats.matchesWon}/${stats.matchesPlayed}`} />
                <StatTile label="Hands Won" value={`${stats.handsWon}/${stats.handsPlayed}`} />
                <StatTile label="Bids Made" value={`${stats.bidsWon}/${stats.bidsMade}`} />
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-card/60 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-base">Recent Matches</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {matches.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No completed matches yet.</p>
                ) : (
                  matches.map((m) => (
                    <div
                      key={m.matchId}
                      className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant={m.won ? "default" : "secondary"} className={m.won ? "bg-emerald-500/80" : ""}>
                          {m.won ? "Won" : "Lost"}
                        </Badge>
                        <div>
                          <p className="text-sm font-medium">
                            Room {m.roomCode} ·{" "}
                            <span className={cn(TEAM_THEME[m.myTeam].text)}>{TEAM_THEME[m.myTeam].label}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(m.endedAt).toLocaleDateString()} · {m.handsPlayed} hands
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-xs">
                        <p className={TEAM_THEME.A.text}>A: {m.teamAPenalty}</p>
                        <p className={TEAM_THEME.B.text}>B: {m.teamBPenalty}</p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        )}
      </motion.div>
    </main>
  );
}
