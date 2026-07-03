// Pure coin-economy math — no I/O, no Prisma. The single source of truth
// for entry-fee tiers and prize-split math, imported by both server/wallet.ts
// (server-authoritative enforcement) and client UI (display only — the
// server always recomputes/re-validates independently, the client never
// gets to assert a balance or a payout).

export interface EntryFeeTier {
  id: "beginner" | "intermediate" | "pro" | "elite";
  label: string;
  entryFee: number;
}

export const ENTRY_FEE_TIERS: EntryFeeTier[] = [
  { id: "beginner", label: "Beginner", entryFee: 100 },
  { id: "intermediate", label: "Intermediate", entryFee: 500 },
  { id: "pro", label: "Pro", entryFee: 1000 },
  { id: "elite", label: "Elite", entryFee: 2000 },
];

const VALID_FEES = new Set(ENTRY_FEE_TIERS.map((t) => t.entryFee));

export function isValidEntryFee(fee: number): boolean {
  return VALID_FEES.has(fee);
}

export function tierForEntryFee(fee: number): EntryFeeTier | undefined {
  return ENTRY_FEE_TIERS.find((t) => t.entryFee === fee);
}

/** Total pool collected from all 4 players (100% of it goes back out — no platform fee). */
export function prizePool(entryFee: number): number {
  return entryFee * 4;
}

/** Each of the 2 winning-team players' share of the pool. */
export function prizePerWinner(entryFee: number): number {
  return entryFee * 2;
}
