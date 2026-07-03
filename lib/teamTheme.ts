import { TeamId } from "@/engine/types";

/** Consistent visual language for the two fixed partnerships across the whole app. */
export const TEAM_THEME: Record<TeamId, {
  label: string;
  text: string;
  bg: string;
  border: string;
  ring: string;
  gradient: string;
  dot: string;
}> = {
  A: {
    label: "Team A",
    text: "text-amber-400",
    bg: "bg-amber-500",
    border: "border-amber-500/40",
    ring: "ring-amber-400",
    gradient: "from-amber-500/20 to-amber-500/0",
    dot: "bg-amber-400",
  },
  B: {
    label: "Team B",
    text: "text-sky-400",
    bg: "bg-sky-500",
    border: "border-sky-500/40",
    ring: "ring-sky-400",
    gradient: "from-sky-500/20 to-sky-500/0",
    dot: "bg-sky-400",
  },
};

export const SUIT_META: Record<string, { symbol: string; color: string; faceColor: string }> = {
  // `color` is for decorative use on dark backgrounds (trump badges, the
  // table's center trump watermark, the suit-picker modal). `faceColor` is
  // specifically for the white card face in PlayingCard.tsx — spades/clubs
  // need a dark tone there, not the near-white `color` used everywhere else.
  SPADES: { symbol: "♠", color: "text-slate-100", faceColor: "text-slate-900" },
  CLUBS: { symbol: "♣", color: "text-slate-100", faceColor: "text-slate-900" },
  HEARTS: { symbol: "♥", color: "text-red-500", faceColor: "text-red-600" },
  DIAMONDS: { symbol: "♦", color: "text-red-500", faceColor: "text-red-600" },
};
