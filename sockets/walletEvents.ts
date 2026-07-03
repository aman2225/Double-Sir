// Wallet balance push notifications. Deliberately minimal — actual reads
// (full balance/stats snapshot, transaction history) go through the REST
// endpoints in app/api/wallet/ (see there for why: the wallet badge needs
// to work on pages with no active room/socket context). This event exists
// purely so a player already connected mid-session sees their balance
// update the INSTANT a transaction affecting them happens (entry-fee
// deduction, prize payout), with no manual refetch. Always sent to one
// player's own socket — balances are private, never room-broadcast.

export interface WalletServerEvents {
  "wallet:balance": (payload: { balance: number; totalEarned: number; totalSpent: number }) => void;
}
