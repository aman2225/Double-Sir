import { describe, expect, it } from "vitest";
import { assertHandInvariant, recordTrickWin } from "../streak";
import { initialStreakState } from "../types";
import type { Seat, StreakState } from "../types";

/** Plays a sequence of trick winners (seat numbers) through recordTrickWin and returns the final state + all handsCollected events, in order. */
function playRounds(winners: Seat[]): { state: StreakState; collections: { team: string; count: number }[] } {
  let state = initialStreakState();
  const collections: { team: string; count: number }[] = [];
  winners.forEach((winner, i) => {
    const result = recordTrickWin(state, winner, i + 1);
    state = result.streak;
    if (result.handsCollected) collections.push(result.handsCollected);
  });
  return { state, collections };
}

describe("Double Sir — consecutive-win trick capture", () => {
  it("Example 1 — simple consecutive wins: P1, P1 captures both tricks for Team A", () => {
    const { state, collections } = playRounds([1, 1]);
    expect(collections).toEqual([{ team: "A", count: 2 }]);
    expect(state.teamAHands).toBe(2);
    expect(state.streakEstablished).toBe(true);
    expect(state.unclaimedHands).toBe(0);
  });

  it("Example 2 — streak continues: P1, P1, P1 captures 2 then 1 more immediately (3 total)", () => {
    const { state, collections } = playRounds([1, 1, 1]);
    expect(collections).toEqual([
      { team: "A", count: 2 },
      { team: "A", count: 1 },
    ]);
    expect(state.teamAHands).toBe(3);
  });

  it("Example 3 — streak broken: P1, P2 captures nothing; both tricks remain unclaimed", () => {
    const { state, collections } = playRounds([1, 2]);
    expect(collections).toEqual([]);
    expect(state.unclaimedHands).toBe(2);
    expect(state.currentStreakPlayer).toBe(2);
    expect(state.currentStreakCount).toBe(1);
    expect(state.streakEstablished).toBe(false);
  });

  it("Example 4 — claiming previously unclaimed tricks: P1, P2, P2 captures all 3", () => {
    const { state, collections } = playRounds([1, 2, 2]);
    expect(collections).toEqual([{ team: "B", count: 3 }]);
    expect(state.teamBHands).toBe(3);
  });

  it("Example 5 — long delay before claim: P1,P2,P3,P4,P4 captures all 5", () => {
    const { state, collections } = playRounds([1, 2, 3, 4, 4]);
    expect(collections).toEqual([{ team: "B", count: 5 }]);
    expect(state.teamBHands).toBe(5);
  });

  it("Example 6 — counter reset: P1,P2,P1,P1 captures all 4 for Team A", () => {
    const { state, collections } = playRounds([1, 2, 1, 1]);
    expect(collections).toEqual([{ team: "A", count: 4 }]);
    expect(state.teamAHands).toBe(4);
  });

  it("Example 7 — teammates do not share streaks: P1, P3 (Team A teammates) captures nothing", () => {
    const { state, collections } = playRounds([1, 3]);
    expect(collections).toEqual([]);
    expect(state.unclaimedHands).toBe(2);
    expect(state.currentStreakPlayer).toBe(3);
    expect(state.currentStreakCount).toBe(1);
  });

  it("Example 8 — long winning streak: P2 x5 captures 2 then 1+1+1 immediately (5 total)", () => {
    const { state, collections } = playRounds([2, 2, 2, 2, 2]);
    expect(collections).toEqual([
      { team: "B", count: 2 },
      { team: "B", count: 1 },
      { team: "B", count: 1 },
      { team: "B", count: 1 },
    ]);
    expect(state.teamBHands).toBe(5);
  });

  it("Example 9 — multiple players before first claim: P1,P2,P3,P1,P1 captures all 5 for Team A", () => {
    const { state, collections } = playRounds([1, 2, 3, 1, 1]);
    expect(collections).toEqual([{ team: "A", count: 5 }]);
    expect(state.teamAHands).toBe(5);
  });

  it("an established hot streak interrupted by another player fully resets (no team-sharing, no lingering established flag)", () => {
    // P2, P2 establishes (captures 2), P2 again captures 1 more (hot streak),
    // then P4 wins — P2's streak, including its established status, is
    // completely lost; P4 starts a brand new streak of one.
    let state = initialStreakState();
    state = recordTrickWin(state, 2, 1).streak;
    state = recordTrickWin(state, 2, 2).streak;
    expect(state.streakEstablished).toBe(true);
    state = recordTrickWin(state, 2, 3).streak;
    expect(state.teamBHands).toBe(3);

    const broken = recordTrickWin(state, 4, 4);
    expect(broken.handsCollected).toBeUndefined();
    expect(broken.streak.currentStreakPlayer).toBe(4);
    expect(broken.streak.currentStreakCount).toBe(1);
    expect(broken.streak.streakEstablished).toBe(false);
    expect(broken.streak.unclaimedHands).toBe(1);
  });

  it("trick 13 forced collection: hand ends without a fresh streak, winner's team takes everything unclaimed", () => {
    let state = initialStreakState();
    state = recordTrickWin(state, 1, 11).streak; // trick 11: P1 starts a streak
    state = recordTrickWin(state, 2, 12).streak; // trick 12: P2 breaks it
    expect(state.unclaimedHands).toBeGreaterThan(0);

    const final = recordTrickWin(state, 3, 13); // trick 13: P3 wins, no fresh streak
    expect(final.handsCollected).toBeDefined();
    expect(final.handsCollected!.team).toBe("A"); // seat 3 -> Team A
    expect(final.streak.unclaimedHands).toBe(0);
  });

  it("trick 13 that naturally completes a fresh 2-streak captures everything, not just 2", () => {
    let state = initialStreakState();
    state = recordTrickWin(state, 1, 9).streak;
    state = recordTrickWin(state, 2, 10).streak;
    state = recordTrickWin(state, 4, 11).streak; // unclaimed = 3, seat 4 streak = 1
    const final = recordTrickWin(state, 4, 13); // trick 13, completes seat 4's streak
    expect(final.handsCollected).toEqual({ team: "B", count: 4 });
  });

  it("trick 13 continuing an already-established hot streak still captures just that one trick, ending the pool at 0", () => {
    let state = initialStreakState();
    state = recordTrickWin(state, 2, 8).streak;
    state = recordTrickWin(state, 2, 9).streak; // established, captured 2
    expect(state.streakEstablished).toBe(true);

    const final = recordTrickWin(state, 2, 13); // trick 13, hot streak continues
    expect(final.handsCollected).toEqual({ team: "B", count: 1 });
    expect(final.streak.unclaimedHands).toBe(0);
  });

  it("invariant: teamAHands + teamBHands always equals 13 across a full randomized-winner hand", () => {
    const winners: Seat[] = [1, 2, 3, 4, 2, 2, 1, 3, 3, 4, 1, 1, 2];
    const { state } = playRounds(winners);
    expect(() => assertHandInvariant(state)).not.toThrow();
    expect(state.teamAHands + state.teamBHands).toBe(13);
  });

  it("invariant holds even when the same player runs a hot streak through to trick 13", () => {
    const winners: Seat[] = [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2];
    const { state } = playRounds(winners);
    expect(() => assertHandInvariant(state)).not.toThrow();
    expect(state.teamAHands + state.teamBHands).toBe(13);
  });

  it("assertHandInvariant throws when totals are inconsistent", () => {
    expect(() =>
      assertHandInvariant({
        unclaimedHands: 0,
        currentStreakPlayer: null,
        currentStreakCount: 0,
        streakEstablished: false,
        teamAHands: 5,
        teamBHands: 5,
      })
    ).toThrow();
  });
});
