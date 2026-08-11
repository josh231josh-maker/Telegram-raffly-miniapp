"use client";

import { useCallback } from "react";

declare global {
  interface Window {
    show_11527679?: (params: { ymid: string }) => Promise<unknown>;
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

// Calling show_11527679 with just { ymid } (no type) shows the zone's
// Rewarded Interstitial format.
export function useMonetagAd() {
  return useCallback(async (ymid: string): Promise<boolean> => {
    if (!window.show_11527679) {
      return false;
    }
    try {
      const showPromise = window.show_11527679({ ymid });
      // If the timeout below wins the race, showPromise is still running
      // underneath and may resolve or reject later on its own, after this
      // call has already moved on -- this discarded .catch() just marks it
      // as handled so a late rejection doesn't surface as an unhandled one.
      // It's attached to the same promise the race observes below, so it
      // doesn't change what the race itself sees.
      showPromise.catch(() => {});
      await Promise.race([
        showPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Ad timed out")), SHOW_AD_TIMEOUT_MS)
        ),
      ]);
      return true;
    } catch {
      return false;
    }
  }, []);
}
