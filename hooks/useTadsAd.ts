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

export type TadsShowResult = { shown: boolean; error?: string };

// Unlike Monetag's show_X({ymid}), which returns a promise, TADS' init()
// is callback-based (onShowReward / onAdsNotFound) with nothing to await --
// this wraps it in a promise so callers can use the same `await showAd()`
// shape as useMonetagAd. Also returns the raw error message on failure
// (not just a boolean) -- while this integration is still being verified
// against TADS' real runtime behavior, that's the only way to see what
// actually went wrong without browser devtools access inside Telegram.
export function useTadsAd() {
  const showAd = useCallback((): Promise<TadsShowResult> => {
    return new Promise((resolve) => {
      if (!window.tads) {
        resolve({ shown: false, error: "window.tads is not defined (widget script didn't load)" });
        return;
      }

      let settled = false;
      const settle = (result: TadsShowResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        resolve(result);
      };
      const timeoutId = setTimeout(() => settle({ shown: false, error: "Timed out" }), SHOW_AD_TIMEOUT_MS);

      // init() throwing synchronously (bad/missing param, an internal SDK
      // bug, whatever) must still settle this promise -- otherwise the
      // caller's await never returns and the UI is stuck on its "watching"
      // state forever, with no path back to idle or a visible failure.
      try {
        window.tads.init({
          widgetId: TADS_WIDGET_ID,
          type: "fullscreen",
          debug: false,
          onShowReward: () => settle({ shown: true }),
          onAdsNotFound: () => settle({ shown: false, error: "onAdsNotFound" }),
        });
      } catch (err) {
        settle({ shown: false, error: err instanceof Error ? err.message : String(err) });
      }
    });
  }, []);

  return { showAd };
}
