import { Seat } from "@/engine/types";

export type TablePosition = "bottom" | "right" | "top" | "left";

/**
 * The viewing player is always rendered at the bottom of the table; the
 * other three seats are laid out clockwise from there in turn order
 * (bidding/play order is 1 -> 2 -> 3 -> 4), so the seat that acts right
 * after "me" appears to my right.
 */
export function relativePosition(mySeat: Seat, targetSeat: Seat): TablePosition {
  const offset = (targetSeat - mySeat + 4) % 4;
  return (["bottom", "right", "top", "left"] as const)[offset];
}
