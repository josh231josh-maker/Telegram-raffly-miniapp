"use client";

import { useCallback } from "react";

declare global {
  interface Window {
    show_11527679?: (params: { type?: string; ymid: string }) => Promise<unknown>;
  }
}

// Monetag's SDK does its own network fetching internally (loading the ad
// creative) with no timeout of its own -- on a slow connection its promise
// can simply never resolve or reject, which looks identical to "the ad
// won't play" from here. Generous enough to cover a slow load plus a full
// rewarded interstitial's playback, but still guarantees this eventually
// gives up and lets the caller treat it as a failed watch instead of
// leaving the button stuck forever.
const SHOW_AD_TIMEOUT_MS = 40_000;
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
