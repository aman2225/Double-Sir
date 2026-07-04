"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useIdentity } from "@/hooks/useIdentity";
import { useAuthStore } from "@/store/useAuthStore";
import { useGameStore } from "@/store/useGameStore";
import { useWalletStore } from "@/store/useWalletStore";
import { SuitBackdrop } from "@/components/lobby/SuitBackdrop";
import { ThemeToggle } from "@/components/ThemeToggle";
import { WalletBadge } from "@/components/wallet/WalletBadge";
import { EntryFeeTierPicker } from "@/components/wallet/EntryFeeTierPicker";
import { ENTRY_FEE_TIERS } from "@/lib/coinEconomy";
import { CreateRoomModal } from "@/components/lobby/CreateRoomModal";

export default function HomePage() {
  const router = useRouter();
  const { player, status } = useIdentity();
  const continueAsGuest = useAuthStore((s) => s.continueAsGuest);
  const clearAuth = useAuthStore((s) => s.clear);
  const createRoom = useGameStore((s) => s.createRoom);
  const joinRoom = useGameStore((s) => s.joinRoom);
  const connected = useGameStore((s) => s.connected);
  const walletBalance = useWalletStore((s) => s.balance);
  const walletLoaded = useWalletStore((s) => s.loaded);
  const fetchWallet = useWalletStore((s) => s.fetchWallet);

  const [guestName, setGuestName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [entryFee, setEntryFee] = useState<number>(ENTRY_FEE_TIERS[0].entryFee);
  const [busy, setBusy] = useState<"guest" | "create" | "join" | null>(null);

  const [createModalOpen, setCreateModalOpen] = useState(false);

  useEffect(() => {
    if (player && !walletLoaded) fetchWallet();
  }, [player, walletLoaded, fetchWallet]);

  async function handleGuestSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guestName.trim()) return;
    setBusy("guest");
    const result = await continueAsGuest(guestName.trim());
    setBusy(null);
    if (!result) toast.error("Couldn't start a guest session. Try again.");
  }

  async function handleCreateRoomSubmit(params: {
    roomName: string;
    entryFee: number;
    targetPoints: number;
    isPrivate: boolean;
    inviteCode?: string;
  }) {
    if (!player) return;
    setBusy("create");
    const result = await createRoom(
      player.displayName,
      params.entryFee,
      params.roomName,
      params.targetPoints,
      params.isPrivate,
      params.inviteCode
    );
    setBusy(null);
    setCreateModalOpen(false);
    if (result.ok && result.roomCode) {
      router.push(`/room/${result.roomCode}`);
    } else {
      toast.error(result.error ?? "Couldn't create a room.");
    }
  }

  async function handleJoinRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!player || !roomCode.trim()) return;
    setBusy("join");
    const result = await joinRoom(roomCode.trim().toUpperCase(), player.displayName);
    setBusy(null);
    if (result.ok && result.roomCode) {
      router.push(`/room/${result.roomCode}`);
    } else {
      toast.error(result.error ?? "Couldn't join that room.");
    }
  }

  async function handleSignOut() {
    clearAuth();
    await signOut({ redirect: false });
    window.location.reload();
  }

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-gradient-to-br from-background via-background to-primary/10 p-4">
      <SuitBackdrop />
      <ThemeToggle className="fixed right-3 top-3 z-50" />
      {player && <WalletBadge />}

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md space-y-6"
      >
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-amber-500 via-slate-900 to-sky-600 bg-clip-text text-transparent dark:from-amber-300 dark:via-white dark:to-sky-300">
            Double Sir
          </h1>
          <p className="text-muted-foreground">A partnership trick-taking game with a twist.</p>
        </div>

        {status === "loading" && !player ? (
          <Card className="border-white/10 bg-card/60 backdrop-blur-xl shadow-2xl">
            <CardContent className="py-10 text-center text-muted-foreground">Loading...</CardContent>
          </Card>
        ) : player ? (
          <Card className="border-white/10 bg-card/60 backdrop-blur-xl shadow-2xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>{player.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-lg">{player.displayName}</CardTitle>
                  <CardDescription>
                    {player.isGuest ? "Playing as guest" : "Signed in"} · {connected ? "Connected" : "Connecting..."}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Choose a room tier</p>
                {/* Balance defaults to Infinity until the wallet finishes its first load, so tiers
                    don't flash "Insufficient coins" for every option during that brief window. */}
                <EntryFeeTierPicker value={entryFee} onChange={setEntryFee} balance={walletLoaded ? walletBalance : Infinity} />
              </div>

              <Button
                className="w-full font-bold bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-black shadow-lg shadow-amber-500/20"
                size="lg"
                onClick={() => setCreateModalOpen(true)}
                disabled={busy !== null || !connected}
              >
                Create Room & Options
              </Button>

              <div className="relative py-1 text-center text-xs text-muted-foreground">
                <span className="bg-card/60 px-2 relative z-10">or join with a code</span>
                <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
              </div>

              <form onSubmit={handleJoinRoom} className="flex gap-2">
                <Input
                  placeholder="ROOM CODE"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="tracking-widest font-mono uppercase"
                />
                <Button type="submit" variant="secondary" disabled={busy !== null || !connected || !roomCode.trim()}>
                  {busy === "join" ? "Joining..." : "Join"}
                </Button>
              </form>

              <Separator />

              <div className="flex items-center justify-between text-sm">
                <Link href="/history" className="text-muted-foreground hover:text-foreground underline underline-offset-4">
                  Match history
                </Link>
                <button onClick={handleSignOut} className="text-muted-foreground hover:text-foreground underline underline-offset-4">
                  {player.isGuest ? "Not you?" : "Sign out"}
                </button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-white/10 bg-card/60 backdrop-blur-xl shadow-2xl">
            <CardHeader>
              <CardTitle>Get started</CardTitle>
              <CardDescription>Jump in instantly as a guest, or sign in to track stats.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleGuestSubmit} className="space-y-2">
                <Label htmlFor="guestName">Display name</Label>
                <div className="flex gap-2">
                  <Input
                    id="guestName"
                    placeholder="Your name"
                    maxLength={24}
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                  />
                  <Button type="submit" disabled={busy !== null || !guestName.trim()}>
                    {busy === "guest" ? "..." : "Play as Guest"}
                  </Button>
                </div>
              </form>

              <div className="relative py-1 text-center text-xs text-muted-foreground">
                <span className="bg-card/60 px-2 relative z-10">or</span>
                <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" nativeButton={false} render={<Link href="/login" />}>
                  Sign in
                </Button>
                <Button variant="outline" nativeButton={false} render={<Link href="/register" />}>
                  Create account
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>

      <CreateRoomModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        walletBalance={walletBalance}
        walletLoaded={walletLoaded}
        connected={connected}
        onCreateRoom={handleCreateRoomSubmit}
        isSubmitting={busy === "create"}
      />
    </main>
  );
}
