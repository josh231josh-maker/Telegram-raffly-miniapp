"use client";

import { useCallback } from "react";

declare global {
  interface Window {
    show_11527679?: (params: { type?: string; ymid: string }) => Promise<unknown>;
  }
}

// Monetag's show_11527679({ ymid }) promise doesn't resolve on its own once
// the ad creative starts playing -- it resolves when the user closes/claims
// the completion screen. That means this wait is dominated by user
// behavior (how long someone takes to tap through), not network speed, and
// is effectively unbounded from here. A short timeout tuned for "slow ad
// load" was cutting off real in-progress watches: anyone who left the ad
// open past it got treated as a failed watch and reset to idle mid-watch,
// even though they were still actively on the ad. Generous enough that it
// only ever fires as a genuine last-resort safety net (e.g. the SDK truly
// hung), not as a response to normal human pacing.
const SHOW_AD_TIMEOUT_MS = 5 * 60_000;
// Preloading is an optimization (see preloadAd below) -- if it hasn't
// finished by this point, showAd() still attempts its own load, so this
// can time out well before SHOW_AD_TIMEOUT_MS without losing anything.
const PRELOAD_TIMEOUT_MS = 15_000;

/**
 * Races a promise against a timeout, resolving/rejecting with whichever
 * finishes first. If the timeout wins, the original promise is still
 * running underneath and may settle later on its own -- attaching a
 * discarded .catch() here (on the same promise the race observes, so it
 * doesn't change what the race sees) keeps a late rejection from
 * surfacing as an unhandled one.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  promise.catch(() => {});
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)),
  ]);
}

export function useMonetagAd() {
  // Monetag recommends preloading each ad's creative (type: "preload")
  // before calling show() for it, specifically for Rewarded Interstitials --
  // without this, show() has to fetch the creative cold, and on a slow
  // connection that fetch may not finish before the SDK gives up and
  // rejects, which looks exactly like "the second ad just fails and I have
  // to start over". Best-effort: if preloading itself fails or times out,
  // showAd() below still attempts to load the ad on its own.
  const preloadAd = useCallback(async (ymid: string): Promise<void> => {
    if (!window.show_11527679) return;
    try {
      await withTimeout(
        window.show_11527679({ type: "preload", ymid }),
        PRELOAD_TIMEOUT_MS,
        "Preload timed out"
      );
    } catch {
      // Not fatal -- see comment above.
    }
  }, []);

  // Calling show_11527679 with just { ymid } (no type) shows the zone's
  // Rewarded Interstitial format.
  const showAd = useCallback(async (ymid: string): Promise<boolean> => {
    if (!window.show_11527679) {
      return false;
    }
    try {
      await withTimeout(window.show_11527679({ ymid }), SHOW_AD_TIMEOUT_MS, "Ad timed out");
      return true;
    } catch {
      return false;
    }
  }, []);

  return { preloadAd, showAd };
}
