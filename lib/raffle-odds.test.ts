import { describe, it, expect } from "vitest";
import { winProbabilityPct } from "@/lib/raffle-odds";

describe("winProbabilityPct", () => {
  it("returns 100% for every entrant when participants don't outnumber the winner slots", () => {
    // Matches pickWinners (lib/raffle-draw.ts): with only 2 entrants and 5
    // winner slots, the draw empties the whole pool -- both entrants win,
    // no matter how lopsided their ticket counts are.
    expect(winProbabilityPct(1, 101, 2, 5)).toBe(100);
    expect(winProbabilityPct(100, 101, 2, 5)).toBe(100);
  });

  it("returns 100% at exactly participants === winnerSlots", () => {
    expect(winProbabilityPct(1, 50, 5, 5)).toBe(100);
  });

  it("falls back to ticket-weighted combinatorics once participants exceed the winner slots", () => {
    // 6 participants, well above 5 slots -- can no longer assume everyone wins.
    const pct = winProbabilityPct(1, 600, 6, 5);
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThan(100);
  });

  it("still returns 100% when your own tickets alone guarantee a win", () => {
    // 10 participants (over the 5 slots), but you hold so many of the total
    // tickets that fewer than 5 tickets remain among everyone else.
    expect(winProbabilityPct(997, 1000, 10, 5)).toBe(100);
  });

  it("returns 0% when you have no tickets or the pool is empty", () => {
    expect(winProbabilityPct(0, 100, 10, 5)).toBe(0);
    expect(winProbabilityPct(5, 0, 0, 5)).toBe(0);
  });
});
