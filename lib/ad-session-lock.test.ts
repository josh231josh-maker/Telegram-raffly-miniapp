import { describe, it, expect, vi, beforeEach } from "vitest";

describe("ad-session-lock", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("defaults rewardedAdActive to false and reflects toggles", async () => {
    const { isRewardedAdActive, setRewardedAdActive } = await import("./ad-session-lock");
    expect(isRewardedAdActive()).toBe(false);
    setRewardedAdActive(true);
    expect(isRewardedAdActive()).toBe(true);
    setRewardedAdActive(false);
    expect(isRewardedAdActive()).toBe(false);
  });

  it("exposes a 40-second gap", async () => {
    const { GAP_MS } = await import("./ad-session-lock");
    expect(GAP_MS).toBe(40_000);
  });

  it("seeds lastAdAt so the very first interstitial is due after a short grace period, not a full gap", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000_000_000);
    try {
      const { GAP_MS, getLastAdAt } = await import("./ad-session-lock");
      const elapsedSinceSeed = Date.now() - getLastAdAt();
      // Not immediately due...
      expect(elapsedSinceSeed).toBeLessThan(GAP_MS);
      // ...but due well before a full gap has to elapse (grace period, not the full 2 minutes).
      expect(elapsedSinceSeed).toBeGreaterThan(GAP_MS / 2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("markAdShown resets lastAdAt to now, pushing the next due time out by a full gap", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000_000_000);
    try {
      const { markAdShown, getLastAdAt } = await import("./ad-session-lock");
      markAdShown();
      expect(getLastAdAt()).toBe(1_000_000_000_000);

      vi.setSystemTime(1_000_000_000_000 + 30_000);
      expect(Date.now() - getLastAdAt()).toBe(30_000);
    } finally {
      vi.useRealTimers();
    }
  });
});
