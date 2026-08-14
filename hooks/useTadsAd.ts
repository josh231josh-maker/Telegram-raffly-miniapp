"use client";

import { useCallback, useRef } from "react";

// TADS' docs show init() returning a thenable that also carries its own
// showAd() method (resolve the promise, then call showAd() to actually
// request an ad) -- but a real production error (Sentry: "r.then is not a
// function", thrown from exactly this call site) proved the object init()
// actually returns at runtime has no .then at all, even though it does
// still have a working .showAd(). Rather than trust either shape blindly,
// this duck-types the return value at runtime and handles both: await it
// if it's genuinely thenable, otherwise treat it as already ready and call
// showAd() immediately.
type TadsController = { showAd?: unknown; then?: unknown };

declare global {
  interface Window {
    tads?: {
      init: (params: {
        widgetId: string;
        type?: string;
        debug?: boolean;
        onShowReward?: (result: unknown) => void;
        onAdsNotFound?: () => void;
      }) => unknown;
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

// init() is only ever called once -- onShowReward/onAdsNotFound are bound
// at that point, not per-watch, and the same controller's showAd() is what
// actually triggers each individual ad request. Lazy (first call to
// showAd(), not on mount) so a session that never taps "Watch Ad" never
// initializes a widget it doesn't use, matching how the ad SDK scripts
// themselves are only loaded afterInteractive rather than upfront.
export function useTadsAd() {
  const controllerRef = useRef<TadsController | null>(null);
  // The resolver for whichever showAd() call is currently in flight --
  // onShowReward/onAdsNotFound are shared across every watch (bound once at
  // init time), so this is what routes the next callback to fire back to
  // the caller actually waiting on it right now. The UI only ever has one
  // watch in flight at a time (the button disables itself while watching),
  // so there's never more than one pending resolver to route to.
  const pendingRef = useRef<((result: TadsShowResult) => void) | null>(null);

  const getController = useCallback((onDebug?: (msg: string) => void): TadsController | null => {
    if (controllerRef.current) return controllerRef.current;
    if (!window.tads) return null;

    const controller = window.tads.init({
      widgetId: TADS_WIDGET_ID,
      type: "fullscreen",
      debug: false,
      onShowReward: () => {
        onDebug?.("onShowReward fired");
        pendingRef.current?.({ shown: true });
        pendingRef.current = null;
      },
      onAdsNotFound: () => {
        onDebug?.("onAdsNotFound fired");
        pendingRef.current?.({ shown: false, error: "onAdsNotFound" });
        pendingRef.current = null;
      },
    }) as TadsController | null | undefined;

    if (!controller || typeof controller !== "object") return null;
    controllerRef.current = controller;
    return controller;
  }, []);

  const showAd = useCallback(
    (onDebug?: (msg: string) => void): Promise<TadsShowResult> => {
      const report = (msg: string) => onDebug?.(msg);

      return new Promise((resolve) => {
        const controller = getController(onDebug);
        if (!controller) {
          report("window.tads is undefined, or init() returned nothing usable");
          resolve({ shown: false, error: "widget script not loaded" });
          return;
        }

        let settled = false;
        const settle = (result: TadsShowResult) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          pendingRef.current = null;
          resolve(result);
        };
        const timeoutId = setTimeout(() => {
          report(`No callback fired within ${SHOW_AD_TIMEOUT_MS / 1000}s`);
          settle({ shown: false, error: "timed out waiting for a callback" });
        }, SHOW_AD_TIMEOUT_MS);

        pendingRef.current = settle;

        const triggerShowAd = () => {
          if (typeof controller.showAd !== "function") {
            report("controller has no showAd() method");
            settle({ shown: false, error: "controller.showAd is not a function" });
            return;
          }
          try {
            report("calling showAd()...");
            (controller.showAd as () => void)();
            report("showAd() called, waiting for a callback...");
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            report(`showAd() threw: ${message}`);
            settle({ shown: false, error: message });
          }
        };

        if (typeof controller.then === "function") {
          report("init() returned a thenable, waiting for it to resolve...");
          (controller.then as (onFulfilled: () => void, onRejected: (err: unknown) => void) => void)(
            () => {
              report("init() resolved");
              triggerShowAd();
            },
            (err: unknown) => {
              const message = err instanceof Error ? err.message : String(err);
              report(`init() rejected: ${message}`);
              settle({ shown: false, error: message });
            }
          );
        } else {
          report("init() did not return a thenable, calling showAd() directly...");
          triggerShowAd();
        }
      });
    },
    [getController]
  );

  return { showAd };
}
