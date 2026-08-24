"use client";

import { useEffect } from "react";
import { isRewardedAdActive } from "@/lib/ad-session-lock";

// Delay before arming, past the moment a fresh session might already be
// showing the daily check-in popup -- a new session's first few seconds
// shouldn't compete for attention with an unrelated ad.
const ARM_DELAY_MS = 8000;

// Passed straight through to Monetag's show_11527679({ type: "inApp", ... })
// call: shows up to 2 ads automatically within a 0.1-hour (6-minute) window,
// 30s apart, with a 5s delay before the first one; everyPage: false keeps
// that window tied to this session rather than resetting on every in-app
// tab switch (Home/Raffles/Profile aren't real navigations here).
const IN_APP_SETTINGS = {
  frequency: 2,
  capping: 0.1,
  interval: 30,
  timeout: 5,
  everyPage: false,
} as const;

// Mounted once, mini-app only (see MiniAppShell) -- this is a single "start
// showing these on your own schedule" call, not a per-ad trigger. Monetag's
// SDK owns the actual timing (frequency/interval/timeout above) from here.
export function MonetagInterstitial() {
  useEffect(() => {
    const timer = setTimeout(() => {
      // WatchAdCard's rewarded ad uses this same Monetag zone -- skip
      // arming if one happens to be in progress right now rather than risk
      // two concurrent calls into the same SDK. Rare at this point in a
      // session, and next session gets another chance to arm.
      if (isRewardedAdActive()) return;
      window.show_11527679?.({ type: "inApp", inAppSettings: IN_APP_SETTINGS });
    }, ARM_DELAY_MS);

    return () => clearTimeout(timer);
  }, []);

  return null;
}
