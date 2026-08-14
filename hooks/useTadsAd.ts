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

// Shortened well below Monetag's 5-minute timeout while this integration is
// still being verified -- Monetag's is long because its promise only
// resolves on real human interaction with an ad UI that's confirmed to
// render, so cutting it short kills genuine slow watches. TADS hasn't been
// confirmed to render anything yet, so waiting 5 minutes to find that out
// just delays debugging for no benefit. Lengthen this back once a real ad
// has been confirmed to show and roughly how long a watch takes.
const SHOW_AD_TIMEOUT_MS = 20_000;

export type TadsShowResult = { shown: boolean; error?: string };

// Unlike Monetag's show_X({ymid}), which returns a promise, TADS' init()
// is callback-based (onShowReward / onAdsNotFound) with nothing to await --
// this wraps it in a promise so callers can use the same `await showAd()`
// shape as useMonetagAd. Also returns the raw error message on failure
// (not just a boolean), and reports live progress via onDebug -- while this
// integration is still being verified against TADS' real runtime behavior,
// that's the only way to see what actually happened without browser
// devtools access inside Telegram.
export function useTadsAd() {
  const showAd = useCallback((onDebug?: (msg: string) => void): Promise<TadsShowResult> => {
    const report = (msg: string) => onDebug?.(msg);

    return new Promise((resolve) => {
      if (!window.tads) {
        report("window.tads is undefined -- widget.js hasn't loaded (yet, or at all)");
        resolve({ shown: false, error: "widget script not loaded" });
        return;
      }
      report("window.tads found, calling init()...");

      let settled = false;
      const settle = (result: TadsShowResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        resolve(result);
      };
      const timeoutId = setTimeout(() => {
        report(`No callback fired within ${SHOW_AD_TIMEOUT_MS / 1000}s`);
        settle({ shown: false, error: "timed out waiting for a callback" });
      }, SHOW_AD_TIMEOUT_MS);

      // init() throwing synchronously (bad/missing param, an internal SDK
      // bug, whatever) must still settle this promise -- otherwise the
      // caller's await never returns and the UI is stuck on its "watching"
      // state forever, with no path back to idle or a visible failure.
      try {
        window.tads.init({
          widgetId: TADS_WIDGET_ID,
          type: "fullscreen",
          debug: false,
          onShowReward: () => {
            report("onShowReward fired");
            settle({ shown: true });
          },
          onAdsNotFound: () => {
            report("onAdsNotFound fired");
            settle({ shown: false, error: "onAdsNotFound" });
          },
        });
        report("init() returned without throwing, waiting for a callback...");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        report(`init() threw: ${message}`);
        settle({ shown: false, error: message });
      }
    });
  }, []);

  return { showAd };
}
