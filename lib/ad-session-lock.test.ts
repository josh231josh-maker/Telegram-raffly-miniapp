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

  it("exposes a 2-minute gap", async () => {
    const { GAP_MS } = await import("./ad-session-lock");
    expect(GAP_MS).toBe(120_000);
  });

  it("seeds lastAdAt so the very first interstitial is due after a short grace period, not a full gap", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000_000_000);
    try {
      const { GAP_MS, getLastAdAt } = await import("./ad-session-lock");
      const elapsedSinceSeed = Date.now() - getLastAdAt();
      // Not immediately due...
      expect(elapsedSinceSeed).toBeLessThan(GAP_MS);
      // ...but due well before a full gap has to elapse (grace period, not the full gap).
      expect(elapsedSinceSeed).toBeGreaterThan(GAP_MS / 2);
      // Specifically: due 30s after load, so the session's first ad is prompt.
      expect(GAP_MS - elapsedSinceSeed).toBe(30_000);
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

  it("defaults interstitialActive to false and reflects toggles", async () => {
    const { isInterstitialActive, setInterstitialActive } = await import("./ad-session-lock");
    expect(isInterstitialActive()).toBe(false);
    setInterstitialActive(true);
    expect(isInterstitialActive()).toBe(true);
    setInterstitialActive(false);
    expect(isInterstitialActive()).toBe(false);
  });

  it("tracks the two ad kinds independently, so neither clears the other's guard", async () => {
    const {
      isRewardedAdActive,
      setRewardedAdActive,
      isInterstitialActive,
      setInterstitialActive,
    } = await import("./ad-session-lock");

    setRewardedAdActive(true);
    expect(isRewardedAdActive()).toBe(true);
    expect(isInterstitialActive()).toBe(false);

    setInterstitialActive(true);
    setRewardedAdActive(false);
    // The rewarded watch ending must not release the interstitial's own guard.
    expect(isRewardedAdActive()).toBe(false);
    expect(isInterstitialActive()).toBe(true);

    setInterstitialActive(false);
  });

  it("leaves the next ad due when no ad was shown, so a failed show doesn't burn a gap", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000_000_000);
    try {
      const { GAP_MS, getLastAdAt } = await import("./ad-session-lock");
      // Seeded past-due at the 30s grace point.
      vi.setSystemTime(1_000_000_000_000 + 30_000);
      const dueNow = () => Date.now() - getLastAdAt() >= GAP_MS;
      expect(dueNow()).toBe(true);

      // A show() that throws never calls markAdShown, so a moment later the
      // ad is still due and the next poll tick can retry it.
      vi.setSystemTime(1_000_000_000_000 + 31_000);
      expect(dueNow()).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
