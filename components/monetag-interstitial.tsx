"use client";

import { useEffect, useRef } from "react";
import { useTelegram } from "@/components/providers/telegram-provider";
import { isPassActive } from "@/lib/raffly-pass";
import {
  GAP_MS,
  getLastAdAt,
  isRewardedAdActive,
  markAdShown,
  setInterstitialActive,
} from "@/lib/ad-session-lock";

// How often this checks whether an interstitial is due. A plain setInterval's
// first tick only lands one full interval after mount, so this also bounds
// how late the first ad of a session can be past its 10s grace period (see
// ad-session-lock's INITIAL_GRACE_MS) -- 1s keeps that, and the recurring
// 2-minute (GAP_MS) cadence, within a negligible margin. The check itself is
// a few comparisons, so running it every second costs nothing.
const POLL_INTERVAL_MS = 1_000;

// A failed show() (no fill, SDK error) deliberately does NOT count as an ad
// shown -- otherwise an ad that never appeared would burn a full GAP_MS. But
// retrying every single second against a zone that simply has no fill would
// hammer it, so a failure backs off this long before the next attempt.
const FAILED_RETRY_BACKOFF_MS = 15_000;

// Mounted once, mini-app only (see MiniAppShell).
//
// Calls Monetag's no-argument, on-demand form: it shows exactly one ad and
// resolves when the user is done with it. The alternative -- the
// { type: "inApp" } automatic mode -- was actively fighting this component:
// its `timeout` added a fixed delay before every ad (so a 3s trigger landed
// at 8s), its frequency/capping pair silently capped delivery at one ad per
// six minutes regardless of what we asked for, and it has no way to know a
// rewarded watch is in progress. Driving single ads ourselves is what makes
// the 10s-then-every-2min cadence, the Pass exemption, and the "never during a
// rewarded watch" rule all actually enforceable.
export function MonetagInterstitial() {
  const { user, loadingUser } = useTelegram();

  // The interval is created once and left alone. Depending on `user` here
  // would tear it down and rebuild it on every refreshUser() -- and
  // WatchAdCard polls refreshUser() every 700ms for ~36s after each watch,
  // faster than this 1s tick, so the interval would be cleared before it
  // ever fired. Reading the latest values through a ref keeps the timer
  // stable while still seeing current state on every tick.
  const stateRef = useRef({ user, loadingUser });
  stateRef.current = { user, loadingUser };

  const showingRef = useRef(false);
  const nextAttemptAtRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(async () => {
      const { user: currentUser, loadingUser: stillLoading } = stateRef.current;

      // Pass status not known yet -- safer to wait than risk showing a pass holder an ad.
      if (stillLoading) return;
      // Raffly Pass: no automatic ads, ever. Re-checked every tick rather
      // than once at arm time, so buying the Pass mid-session stops ads
      // immediately instead of on the next app open.
      if (isPassActive(currentUser?.raffly_pass_expires_at ?? null)) return;
      if (showingRef.current) return; // our own ad is still on screen
      if (isRewardedAdActive()) return; // never interrupt an active rewarded watch
      if (document.hidden) return; // app backgrounded -- don't burn an ad nobody can see
      if (Date.now() < nextAttemptAtRef.current) return; // backing off after a failure
      if (Date.now() - getLastAdAt() < GAP_MS) return; // not due yet

      // Monetag's script loads afterInteractive (a third-party network
      // fetch), so this can still be undefined for the first few seconds of
      // a session -- exactly when the 10s grace period lands. Bail without
      // marking anything, so the next tick retries rather than losing the
      // session's first ad entirely.
      const show = window.show_11527679;
      if (typeof show !== "function") return;

      showingRef.current = true;
      setInterstitialActive(true);
      try {
        await show();
        // Marked only once the ad has genuinely been shown and dismissed, so
        // the next gap counts from when this ad ended rather than when it
        // was requested.
        markAdShown();
      } catch {
        nextAttemptAtRef.current = Date.now() + FAILED_RETRY_BACKOFF_MS;
      } finally {
        showingRef.current = false;
        setInterstitialActive(false);
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  return null;
}
