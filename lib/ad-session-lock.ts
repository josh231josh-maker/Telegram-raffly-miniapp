// Plain module-scoped flag, not React state -- both WatchAdCard's rewarded
// flow and the automatic in-app interstitial call into the same Monetag
// zone (11527679), and the two aren't otherwise related components with any
// shared state. This is just a "is a rewarded watch in progress right now"
// signal the interstitial checks before arming itself, so the two never
// fire into the SDK at the same time.
let rewardedAdActive = false;

export function setRewardedAdActive(active: boolean): void {
  rewardedAdActive = active;
}

export function isRewardedAdActive(): boolean {
  return rewardedAdActive;
}
