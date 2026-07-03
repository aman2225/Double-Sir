import { NextResponse } from "next/server";
import { getCurrentPlayer } from "@/lib/currentPlayer";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 20;

/** Cursor-paginated transaction history — satisfies "lazy-load transaction history" rather than shipping the full ledger on every wallet-panel open. */
export async function GET(request: Request) {
  const player = await getCurrentPlayer();
  if (!player) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || PAGE_SIZE));

  const transactions = await prisma.walletTransaction.findMany({
    where: { playerProfileId: player.playerProfileId },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = transactions.length > limit;
  const page = hasMore ? transactions.slice(0, limit) : transactions;

  return NextResponse.json({
    transactions: page.map((t) => ({
      id: t.id,
      matchId: t.matchId,
      roomId: t.roomId,
      type: t.type,
      amount: t.amount,
      balanceAfter: t.balanceAfter,
      description: t.description,
      createdAt: t.createdAt,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}
