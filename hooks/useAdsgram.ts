"use client";

import { useCallback, useRef } from "react";

declare global {
  interface Window {
    Adsgram?: {
      init: (params: { blockId: string; debug?: boolean }) => {
        show: () => Promise<unknown>;
      };
    };
  }
}

// AdsGram's own dashboard identifier for the ad unit this app was set up
// with -- not a secret, this is meant to be embedded client-side (AdsGram's
// SDK reads it to know which ad slot/fill to serve).
export const ADSGRAM_BLOCK_ID = "44046";

// Same reasoning as Monetag's timeout (hooks/useMonetagAd.ts): show()
// settles on real human interaction with the ad UI, not network speed, so
// this only ever fires as a last-resort safety net for a genuinely hung SDK.
const SHOW_AD_TIMEOUT_MS = 5 * 60_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  promise.catch(() => {});
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)),
  ]);
}

// AdsGram's own docs: calling init() again for the same blockId just returns
// the same controller, so this only needs to happen once -- lazily, on the
// first watch attempt, so a session that never taps "Watch Ad" never
// initializes a widget it doesn't use (same convention as useTadsAd/useMonetagAd).
export function useAdsgramAd() {
  const controllerRef = useRef<{ show: () => Promise<unknown> } | null>(null);

  const getController = useCallback(() => {
    if (controllerRef.current) return controllerRef.current;
    if (!window.Adsgram) return null;
    controllerRef.current = window.Adsgram.init({ blockId: ADSGRAM_BLOCK_ID });
    return controllerRef.current;
  }, []);

  // AdsGram determines which Telegram user is watching from the Mini App
  // context itself (there's no identifier to pass in here) -- see the
  // comment on app/api/ads/adsgram-reward/route.ts for why that means this
  // integration can't use the same signed-token binding Monetag's does.
  const showAd = useCallback(async (): Promise<boolean> => {
    const controller = getController();
    if (!controller) return false;
    try {
      await withTimeout(controller.show(), SHOW_AD_TIMEOUT_MS, "Ad timed out");
      return true;
    } catch {
      return false;
    }
  }, [getController]);

  return { showAd };
}
