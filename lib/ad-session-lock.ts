// Plain module-scoped state, not React state -- WatchAdCard's rewarded flow
// and the automatic in-app interstitial (components/monetag-interstitial.tsx)
// both call into the same Monetag zone (11527679), and the two aren't
// otherwise related components with any shared state.

// "Is a rewarded watch in progress right now" -- the interstitial checks
// this before ever firing, so the two never call into the SDK at once and a
// rewarded watch is never interrupted.
let rewardedAdActive = false;

export function setRewardedAdActive(active: boolean): void {
  rewardedAdActive = active;
}

export function isRewardedAdActive(): boolean {
  return rewardedAdActive;
}

// When any ad (rewarded or the automatic interstitial) last actually
// finished showing -- the interstitial's own 2-minute cadence counts down
// from this moment, not from a fixed schedule, so watching a rewarded ad
// pushes the next automatic interstitial back by the same 2 minutes.
//
// Seeded at module load slightly in the past so the very first interstitial
// of a session still fires a short grace period (INITIAL_GRACE_MS, kept in
// monetag-interstitial.tsx) after load rather than making that first ad
// wait a full 2 minutes too.
const GAP_MS = 2 * 60_000;
const INITIAL_GRACE_MS = 8_000;
let lastAdAt = Date.now() - GAP_MS + INITIAL_GRACE_MS;

export function markAdShown(): void {
  lastAdAt = Date.now();
}

export function getLastAdAt(): number {
  return lastAdAt;
}

export { GAP_MS };
