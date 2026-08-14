"use client";

import { useCallback } from "react";

declare global {
  interface Window {
    tads?: {
      init: (params: {
        widgetId: string;
        type?: string;
        debug?: boolean;
        onShowReward?: (result: unknown) => void;
        onAdsNotFound?: () => void;
      }) => void;
    };
  }
}

const TADS_WIDGET_ID = "11523";

// Same safety-net reasoning as Monetag's SHOW_AD_TIMEOUT_MS (hooks/useMonetagAd.ts):
// generous enough to never cut off a real in-progress watch, only a genuinely
// hung SDK that never calls either callback back.
const SHOW_AD_TIMEOUT_MS = 5 * 60_000;

// Unlike Monetag's show_X({ymid}), which returns a promise, TADS' init()
// is callback-based (onShowReward / onAdsNotFound) with nothing to await --
// this wraps it in a promise so callers can use the same `await showAd()`
// shape as useMonetagAd.
export function useTadsAd() {
  const showAd = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!window.tads) {
        resolve(false);
        return;
      }

      let settled = false;
      const settle = (result: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        resolve(result);
      };
      const timeoutId = setTimeout(() => settle(false), SHOW_AD_TIMEOUT_MS);

      window.tads.init({
        widgetId: TADS_WIDGET_ID,
        type: "fullscreen",
        debug: false,
        onShowReward: () => settle(true),
        onAdsNotFound: () => settle(false),
      });
    });
  }, []);

  return { showAd };
}
