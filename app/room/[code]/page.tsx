"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Copy, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useIdentity } from "@/hooks/useIdentity";
import { useGameStore } from "@/store/useGameStore";
import { SeatCard } from "@/components/lobby/SeatCard";
import { SuitBackdrop } from "@/components/lobby/SuitBackdrop";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CommsDock } from "@/components/comms/CommsDock";
import { useCommsNotifications } from "@/hooks/useCommsNotifications";
import { useMusicNotifications } from "@/hooks/useMusicNotifications";
import { MusicEngine } from "@/components/music/MusicEngine";
import { MusicPlayer } from "@/components/music/MusicPlayer";
import { WalletBadge } from "@/components/wallet/WalletBadge";
import { SEATS, Seat } from "@/engine/types";
import { FELT_SURFACE, GOLD_TEXT } from "@/lib/tableTheme";

export default function RoomLobbyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const roomCode = code.toUpperCase();
  const router = useRouter();
  const { player } = useIdentity();
  const connected = useGameStore((s) => s.connected);
  const roomState = useGameStore((s) => s.roomState);
  const joinRoom = useGameStore((s) => s.joinRoom);
  const leaveRoom = useGameStore((s) => s.leaveRoom);
  const startGame = useGameStore((s) => s.startGame);

  const [copied, setCopied] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const joinAttempted = useRef(false);

  const seatNames: Record<Seat, string> = {} as Record<Seat, string>;
  for (const seat of SEATS) {
    seatNames[seat] = roomState?.players.find((p) => p.seat === seat)?.displayName ?? `Player ${seat}`;
  }
  useCommsNotifications(seatNames);
  useMusicNotifications();

  useEffect(() => {
    if (!player || !connected || joinAttempted.current) return;
    joinAttempted.current = true;
    joinRoom(roomCode, player.displayName).then((res) => {
      if (!res.ok) setJoinError(res.error ?? "Could not join this room.");
    });
  }, [player, connected, joinRoom, roomCode]);

  useEffect(() => {
    if (roomState && roomState.status !== "LOBBY") {
      router.push(`/game/${roomCode}`);
    }
  }, [roomState, roomCode, router]);

  function handleCopy() {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleLeave() {
    leaveRoom(roomCode);
    router.push("/");
  }

  const isHost = roomState?.hostPlayerProfileId === player?.playerProfileId;
  const filled = roomState?.players.length ?? 0;
  const me = roomState?.players.find((p) => p.playerProfileId === player?.playerProfileId);

  return (
    <main className={`table-theme relative flex flex-1 items-center justify-center overflow-hidden p-4 ${FELT_SURFACE}`}>
      <SuitBackdrop />
      <ThemeToggle className="fixed right-3 top-3 z-50" />
      {player && <WalletBadge />}

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-2xl"
      >
        <Card className="border-[var(--gold)]/20 bg-black/40 backdrop-blur-xl shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className={`text-2xl ${GOLD_TEXT}`}>{roomState?.roomName || "Game Lobby"}</CardTitle>
              <p className="text-sm text-muted-foreground">Share this code so friends can join.</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleCopy} className="font-mono text-lg tracking-widest">
              {roomCode}
              {copied ? <Check className="ml-2 h-4 w-4" /> : <Copy className="ml-2 h-4 w-4" />}
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {roomState && roomState.entryFee > 0 && (
              <div className="flex items-center justify-center gap-4 rounded-lg border border-[var(--gold)]/20 bg-[var(--gold)]/5 px-3 py-2 text-sm">
                <span>
                  🪙 Entry: <strong>{roomState.entryFee.toLocaleString()}</strong>
                </span>
                <span>
                  🏆 Prize Pool: <strong>{roomState.prizePool.toLocaleString()}</strong>
                </span>
                <span>
                  Each Winner: <strong>+{(roomState.prizePool / 2).toLocaleString()}</strong>
                </span>
              </div>
            )}
            {joinError ? (
              <p className="text-center text-sm text-destructive">{joinError}</p>
            ) : !roomState ? (
              <p className="text-center text-sm text-muted-foreground">Connecting to room...</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {SEATS.map((seat) => (
                    <SeatCard
                      key={seat}
                      seat={seat}
                      occupant={roomState.players.find((p) => p.seat === seat)}
                      isSelf={roomState.players.find((p) => p.seat === seat)?.playerProfileId === player?.playerProfileId}
                    />
                  ))}
                </div>

                <div className="flex flex-col items-center gap-3">
                  <Badge variant="secondary">{filled}/4 players joined</Badge>

                  {isHost ? (
                    <Button size="lg" className="w-full max-w-xs" disabled={filled < 4} onClick={() => startGame(roomCode)}>
                      {filled < 4 ? "Waiting for players..." : "Start Game"}
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {filled < 4 ? "Waiting for more players to join..." : "Waiting for the host to start the game..."}
                    </p>
                  )}

                  <Button variant="ghost" size="sm" onClick={handleLeave} className="text-muted-foreground">
                    <LogOut className="mr-2 h-4 w-4" /> Leave room
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {roomState && player && me && (
        <>
          <CommsDock
            roomCode={roomCode}
            mySeat={me.seat}
            myPlayerProfileId={player.playerProfileId}
            otherSeats={SEATS.filter((s) => s !== me.seat)}
            seatNames={seatNames}
          />
          <MusicEngine />
          <MusicPlayer roomCode={roomCode} isHost={isHost} />
        </>
      )}
    </main>
  );
}
