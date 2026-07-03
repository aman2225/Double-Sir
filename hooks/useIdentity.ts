"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useGameStore } from "@/store/useGameStore";

/**
 * Bootstraps the current player's identity (next-auth session or guest
 * cookie) on mount and, once resolved, opens the Socket.IO connection with
 * the signed player token. Shared by every page that needs realtime access.
 */
export function useIdentity() {
  const player = useAuthStore((s) => s.player);
  const status = useAuthStore((s) => s.status);
  const refresh = useAuthStore((s) => s.refresh);
  const connect = useGameStore((s) => s.connect);

  useEffect(() => {
    if (status === "idle") refresh();
  }, [status, refresh]);

  useEffect(() => {
    if (player?.token) connect(player.token);
  }, [player?.token, connect]);

  return { player, status };
}
