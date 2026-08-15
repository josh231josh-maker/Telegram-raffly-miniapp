import { describe, it, expect } from "vitest";
import { winProbabilityPct } from "@/lib/raffle-odds";

describe("winProbabilityPct", () => {
  it("is purely a function of tickets held vs. the total ticket pool", () => {
    // Deliberately doesn't special-case on how many people have entered --
    // a lopsided ticket split between few entrants still weighs by tickets.
    const pct = winProbabilityPct(1, 101, 5);
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThan(100);
  });

  it("weighs more of the total pool as a higher chance", () => {
    const low = winProbabilityPct(1, 1000, 5);
    const high = winProbabilityPct(500, 1000, 5);
    expect(high).toBeGreaterThan(low);
  });

  it("returns 100% when your own tickets alone guarantee a win", () => {
    // So few tickets remain among everyone else that all winner slots must
    // include you.
    expect(winProbabilityPct(997, 1000, 5)).toBe(100);
  });

  it("returns 100% when the winner slots cover the whole ticket pool", () => {
    expect(winProbabilityPct(1, 5, 5)).toBe(100);
  });

  it("returns 0% when you have no tickets or the pool is empty", () => {
    expect(winProbabilityPct(0, 100, 5)).toBe(0);
    expect(winProbabilityPct(5, 0, 5)).toBe(0);
  });
});
