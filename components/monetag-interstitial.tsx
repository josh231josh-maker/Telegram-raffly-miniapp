"use client";

import { useEffect } from "react";
import { useTelegram } from "@/components/providers/telegram-provider";
import { isPassActive } from "@/lib/raffly-pass";
import { GAP_MS, getLastAdAt, isRewardedAdActive, markAdShown } from "@/lib/ad-session-lock";

// How often this checks whether an interstitial is due -- coarser than the
// gap itself, since firing a little late is harmless but firing early
// defeats the point of the gap. A plain setInterval's first tick only lands
// one full POLL_INTERVAL_MS after mount, so this also bounds how late the
// very first ad of a session can fire past its 3s grace period (see
// ad-session-lock's INITIAL_GRACE_MS) -- 1s keeps that, and the recurring
// 40s (GAP_MS) cadence, within a negligible margin of the intended timing.
const POLL_INTERVAL_MS = 1_000;

// Each check only ever asks Monetag for a single ad ("frequency: 1") --
// unlike the original one-shot arm-and-let-Monetag-schedule-the-rest
// approach, the GAP_MS cadence and the "never during a rewarded watch"
// rule both live in our own polling logic below, since Monetag's own
// frequency/interval knobs have no way to know about that rewarded-watch
// state. capping/interval/timeout are still passed through for whatever
// per-call pacing Monetag applies around the single ad this asks for.
const IN_APP_SETTINGS = {
  frequency: 1,
  capping: 0.1,
  interval: 30,
  timeout: 5,
  everyPage: false,
} as const;

// Mounted once, mini-app only (see MiniAppShell). Polls rather than using a
// single scheduled timer because "when the next ad is due" can be pushed
// back at any moment by WatchAdCard calling markAdShown() on its own --
// a plain setTimeout computed once wouldn't notice that reset.
export function MonetagInterstitial() {
  const { user, loadingUser } = useTelegram();

  useEffect(() => {
    const interval = setInterval(() => {
      if (loadingUser) return; // pass status not known yet -- safer to wait than risk showing a pass holder an ad
      if (isPassActive(user?.raffly_pass_expires_at ?? null)) return; // Raffly Pass: no automatic ads, ever
      if (isRewardedAdActive()) return; // never interrupt an active rewarded watch
      if (Date.now() - getLastAdAt() < GAP_MS) return; // not due yet

      // Monetag's script tag loads afterInteractive (a third-party network
      // fetch), so window.show_11527679 can still be undefined for the
      // first few seconds of a session -- especially right around the
      // initial 3s grace period this is trying to hit. Previously this
      // called it optionally and marked an ad "shown" regardless, which
      // silently burned the very first eligible check (and reset the gap
      // timer) even when nothing actually played, making the first ad of a
      // session miss entirely. Only mark shown when the SDK was actually
      // callable, so an early miss just gets retried on the next poll tick
      // instead of waiting out a whole new GAP_MS for nothing.
      if (typeof window.show_11527679 !== "function") return;
      window.show_11527679({ type: "inApp", inAppSettings: IN_APP_SETTINGS });
      markAdShown();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [user, loadingUser]);

  return null;
}
