"use client";

import { useCallback } from "react";

declare global {
  interface Window {
    show_11527679?: (params: { ymid: string }) => Promise<unknown>;
  }
}

// Calling show_11527679 with just { ymid } (no type) shows the zone's
// Rewarded Interstitial format.
export function useMonetagAd() {
  return useCallback(async (ymid: string): Promise<boolean> => {
    if (!window.show_11527679) {
      return false;
    }
    try {
      await window.show_11527679({ ymid });
      return true;
    } catch {
      return false;
    }
  }, []);
}
