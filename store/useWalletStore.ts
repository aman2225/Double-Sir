import { create } from "zustand";
import { AppSocket } from "@/sockets/client";

export interface WalletTransactionView {
  id: string;
  matchId: string | null;
  roomId: string | null;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string | null;
  createdAt: string;
}

interface WalletStoreState {
  loaded: boolean;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  matchesPlayed: number;
  matchesWon: number;

  transactions: WalletTransactionView[];
  transactionsCursor: string | null;
  transactionsHasMore: boolean;
  transactionsLoading: boolean;

  fetchWallet: () => Promise<void>;
  fetchMoreTransactions: () => Promise<void>;
  bindToSocket: (socket: AppSocket) => void;
}

/**
 * Wallet balance is always server-authoritative — this store never
 * computes a balance itself, it only renders what /api/wallet and the
 * "wallet:balance" socket push tell it. No zustand `persist`: caching a
 * stale balance across sessions would be actively misleading, unlike the
 * purely personal preferences (volume, mute) other stores persist.
 */
export const useWalletStore = create<WalletStoreState>((set, get) => ({
  loaded: false,
  balance: 0,
  totalEarned: 0,
  totalSpent: 0,
  matchesPlayed: 0,
  matchesWon: 0,

  transactions: [],
  transactionsCursor: null,
  transactionsHasMore: true,
  transactionsLoading: false,

  fetchWallet: async () => {
    const res = await fetch("/api/wallet");
    if (!res.ok) return;
    const data = await res.json();
    set({
      loaded: true,
      balance: data.balance,
      totalEarned: data.totalEarned,
      totalSpent: data.totalSpent,
      matchesPlayed: data.matchesPlayed,
      matchesWon: data.matchesWon,
    });
  },

  fetchMoreTransactions: async () => {
    const { transactionsLoading, transactionsHasMore, transactionsCursor, transactions } = get();
    if (transactionsLoading || !transactionsHasMore) return;
    set({ transactionsLoading: true });
    try {
      const url = new URL("/api/wallet/transactions", window.location.origin);
      if (transactionsCursor) url.searchParams.set("cursor", transactionsCursor);
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      set({
        transactions: [...transactions, ...data.transactions],
        transactionsCursor: data.nextCursor,
        transactionsHasMore: data.nextCursor !== null,
      });
    } finally {
      set({ transactionsLoading: false });
    }
  },

  bindToSocket: (socket) => {
    socket.off("wallet:balance");
    socket.on("wallet:balance", ({ balance, totalEarned, totalSpent }) => {
      set({ loaded: true, balance, totalEarned, totalSpent });
    });
  },
}));
