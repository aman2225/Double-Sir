"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useWalletStore, WalletTransactionView } from "@/store/useWalletStore";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<string, string> = {
  SIGNUP_BONUS: "Welcome Bonus",
  MATCH_ENTRY: "Match Entry",
  MATCH_VICTORY: "Match Victory",
  REFUND: "Refund",
  ADJUSTMENT: "Adjustment",
};

function TransactionRow({ tx }: { tx: WalletTransactionView }) {
  const credit = tx.amount > 0;
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
      <div>
        <p className="text-sm font-medium">{TYPE_LABEL[tx.type] ?? tx.type}</p>
        <p className="text-[10px] text-muted-foreground">{new Date(tx.createdAt).toLocaleString()}</p>
      </div>
      <div className="text-right">
        <p className={cn("text-sm font-semibold tabular-nums", credit ? "text-emerald-400" : "text-red-400")}>
          {credit ? "+" : ""}
          {tx.amount.toLocaleString()}
        </p>
        <p className="text-[10px] text-muted-foreground tabular-nums">Balance: {tx.balanceAfter.toLocaleString()}</p>
      </div>
    </div>
  );
}

export function WalletPanel() {
  const balance = useWalletStore((s) => s.balance);
  const totalEarned = useWalletStore((s) => s.totalEarned);
  const totalSpent = useWalletStore((s) => s.totalSpent);
  const matchesPlayed = useWalletStore((s) => s.matchesPlayed);
  const matchesWon = useWalletStore((s) => s.matchesWon);
  const transactions = useWalletStore((s) => s.transactions);
  const transactionsHasMore = useWalletStore((s) => s.transactionsHasMore);
  const transactionsLoading = useWalletStore((s) => s.transactionsLoading);
  const fetchMoreTransactions = useWalletStore((s) => s.fetchMoreTransactions);

  useEffect(() => {
    if (transactions.length === 0) fetchMoreTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = [
    { label: "Total Earned", value: totalEarned },
    { label: "Total Spent", value: totalSpent },
    { label: "Matches Played", value: matchesPlayed },
    { label: "Matches Won", value: matchesWon },
  ];

  return (
    <SheetContent side="right" className="w-full border-[var(--gold,#facc15)]/20 bg-black/90 backdrop-blur-2xl sm:max-w-sm">
      <SheetHeader>
        <SheetTitle className="text-[var(--gold,#facc15)]">Wallet</SheetTitle>
        <SheetDescription>Virtual coins — never redeemable for real money.</SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-[var(--gold,#facc15)]/30 bg-gradient-to-br from-[var(--gold,#facc15)]/15 to-transparent p-4 text-center"
        >
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Balance</p>
          <p className="mt-1 text-3xl font-bold text-[var(--gold,#facc15)]">🪙 {balance.toLocaleString()}</p>
        </motion.div>

        <div className="grid grid-cols-2 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center">
              <p className="text-lg font-semibold tabular-nums">{s.value.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Recent Transactions</p>
          {transactions.length === 0 && !transactionsLoading && (
            <p className="py-4 text-center text-xs text-muted-foreground">No transactions yet.</p>
          )}
          {transactions.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} />
          ))}
          {transactionsHasMore && (
            <Button variant="outline" size="sm" className="w-full" disabled={transactionsLoading} onClick={() => fetchMoreTransactions()}>
              {transactionsLoading ? "Loading..." : "Load more"}
            </Button>
          )}
        </div>
      </div>
    </SheetContent>
  );
}
