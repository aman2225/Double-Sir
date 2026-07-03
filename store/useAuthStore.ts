import { create } from "zustand";

export interface PlayerIdentity {
  playerProfileId: string;
  displayName: string;
  avatarUrl?: string;
  isGuest: boolean;
  /** Signed token handed to the Socket.IO connection for realtime auth. */
  token: string;
}

interface AuthState {
  player: PlayerIdentity | null;
  status: "idle" | "loading" | "ready" | "error";
  /** Fetches /api/session; resolves an existing next-auth session or guest cookie. Does not create a guest. */
  refresh: () => Promise<PlayerIdentity | null>;
  /** Creates (or reuses) a guest identity, then refreshes the session token. */
  continueAsGuest: (displayName: string) => Promise<PlayerIdentity | null>;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  player: null,
  status: "idle",

  refresh: async () => {
    set({ status: "loading" });
    try {
      const res = await fetch("/api/session");
      if (!res.ok) {
        set({ player: null, status: "ready" });
        return null;
      }
      const player = (await res.json()) as PlayerIdentity;
      set({ player, status: "ready" });
      return player;
    } catch {
      set({ status: "error" });
      return null;
    }
  },

  continueAsGuest: async (displayName: string) => {
    set({ status: "loading" });
    try {
      const res = await fetch("/api/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      if (!res.ok) {
        set({ status: "error" });
        return null;
      }
      return get().refresh();
    } catch {
      set({ status: "error" });
      return null;
    }
  },

  clear: () => set({ player: null, status: "idle" }),
}));
