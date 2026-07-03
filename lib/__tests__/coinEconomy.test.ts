import { describe, expect, it } from "vitest";
import { ENTRY_FEE_TIERS, isValidEntryFee, prizePerWinner, prizePool, tierForEntryFee } from "../coinEconomy";

describe("coin economy — entry fee tiers and prize math", () => {
  it("has exactly the 4 tiers from the spec", () => {
    expect(ENTRY_FEE_TIERS.map((t) => t.entryFee)).toEqual([100, 500, 1000, 2000]);
  });

  it.each([
    [100, 400, 200],
    [500, 2000, 1000],
    [1000, 4000, 2000],
    [2000, 8000, 4000],
  ])("Beginner/Intermediate/Pro/Elite worked examples: entryFee=%i -> pool=%i, perWinner=%i", (entryFee, pool, perWinner) => {
    expect(prizePool(entryFee)).toBe(pool);
    expect(prizePerWinner(entryFee)).toBe(perWinner);
    // No platform fee: the pool is always exactly divisible between the 2 winners with nothing left over.
    expect(perWinner * 2).toBe(pool);
  });

  it("rejects arbitrary fees not in the fixed tier list", () => {
    expect(isValidEntryFee(100)).toBe(true);
    expect(isValidEntryFee(2000)).toBe(true);
    expect(isValidEntryFee(150)).toBe(false);
    expect(isValidEntryFee(0)).toBe(false);
    expect(isValidEntryFee(-100)).toBe(false);
  });

  it("resolves a tier by its exact entry fee", () => {
    expect(tierForEntryFee(500)?.label).toBe("Intermediate");
    expect(tierForEntryFee(999)).toBeUndefined();
  });
});
