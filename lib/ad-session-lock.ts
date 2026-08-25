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

// The mirror of the flag above: "is an automatic interstitial on screen
// right now". Without this the guard only ran one way -- the interstitial
// checked for a rewarded watch, but a rewarded watch never checked for an
// interstitial, so both could end up driving the same Monetag global at
// once (the hazard watch-ad-card.tsx already documents for preload+show).
let interstitialActive = false;

export function setInterstitialActive(active: boolean): void {
  interstitialActive = active;
}

export function isInterstitialActive(): boolean {
  return interstitialActive;
}

// When any ad (rewarded or the automatic interstitial) last actually
// finished showing -- the interstitial's own cadence counts down from this
// moment, not from a fixed schedule, so watching a rewarded ad pushes the
// next automatic interstitial back by the same gap.
//
// Seeded at module load slightly in the past so the very first interstitial
// of a session still fires a short grace period (INITIAL_GRACE_MS below)
// after load rather than making that first ad wait a full gap too.
const GAP_MS = 40_000;
const INITIAL_GRACE_MS = 3_000;
let lastAdAt = Date.now() - GAP_MS + INITIAL_GRACE_MS;

export function markAdShown(): void {
  lastAdAt = Date.now();
}

export function getLastAdAt(): number {
  return lastAdAt;
}

export { GAP_MS };
