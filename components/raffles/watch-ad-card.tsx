"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useMonetagAd } from "@/hooks/useMonetagAd";
import { useTelegram } from "@/components/providers/telegram-provider";
import { useLanguage } from "@/components/providers/language-provider";
import { isPassActive } from "@/lib/raffly-pass";
import { fetchWithRetry } from "@/lib/fetch-retry";
import { setRewardedAdActive, markAdShown, isInterstitialActive } from "@/lib/ad-session-lock";
import { TaskRow } from "@/components/raffles/task-row";
import { TaskRowSkeleton } from "@/components/raffles/task-row-skeleton";

type Status = "idle" | "ad1" | "gap" | "ad2" | "checking" | "done" | "failed";

// Pause between the two ads so the second doesn't feel like it's firing on
// top of the first.
const AD_GAP_MS = 3000;

// The postback that credits the ticket can land well after the ad itself
// finishes -- sometimes only once the app is reopened. Poll on-screen just
// long enough to catch the common fast case (most postbacks land in a
// couple seconds), then keep polling quietly in the background instead of
// telling the user it failed, since a slow postback isn't a failed one.
const POSTBACK_POLL_INTERVAL_MS = 700;
const POSTBACK_VISIBLE_ATTEMPTS = 12; // ~8.4s on-screen as "Checking..."
const POSTBACK_BACKGROUND_ATTEMPTS = 40; // ~28s more, quietly, after the button is usable again

// Mirrors the server-side cooldown in record_ad_view/mint-reward-token --
// only used here to render the live countdown, the actual enforcement is
// the server rejecting the token mint. Under an hour shows mm:ss, at or
// past an hour shows h:mm:ss (the cooldown is capped at 2 hours server-side,
// so this never needs to handle a day+ remaining).
function formatRemaining(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function WatchAdCard() {
  const { user, refreshUser, loadingUser, getInitData } = useTelegram();
  const { t } = useLanguage();
  const [status, setStatus] = useState<Status>("idle");
  const [gapSecondsLeft, setGapSecondsLeft] = useState(0);
  const [adCooldownUntil, setAdCooldownUntil] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const { preloadAd, showAd } = useMonetagAd();

  // Keeps the locally-known cooldown in sync with whatever the user object
  // carries -- e.g. a cooldown that was set by a watch on another device/
  // session and only shows up once refreshUser() picks up the latest row,
  // or simply what's already there on first load so the countdown is
  // visible immediately instead of only after a rejected watch attempt.
  useEffect(() => {
    setAdCooldownUntil(user?.ad_cooldown_until ?? null);
  }, [user?.ad_cooldown_until]);

  const cooldownRemainingMs = adCooldownUntil ? new Date(adCooldownUntil).getTime() - nowTick : 0;
  const inCooldown = cooldownRemainingMs > 0;

  // Ticks once a second only while an active cooldown is actually being
  // displayed, so this component isn't running an interval for the entire
  // time it's mounted and idle.
  useEffect(() => {
    if (!inCooldown) return;
    const interval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [inCooldown]);

  // Marks the shared Monetag zone busy for as long as this component's own
  // watch flow is active, so the automatic in-app interstitial (see
  // components/monetag-interstitial.tsx) knows not to arm itself into the
  // same SDK mid-watch. Reset on every status change and on unmount, not
  // just when leaving "idle" -- a stale "busy" left set past this
  // component's own lifetime would silently block the interstitial forever.
  useEffect(() => {
    const busy = status === "ad1" || status === "gap" || status === "ad2" || status === "checking";
    setRewardedAdActive(busy);
    return () => setRewardedAdActive(false);
  }, [status]);

  // Bumped whenever a new watch starts, and once on unmount. A poll loop
  // checks this before every step and against the generation it was started
  // with, so starting a second watch (or navigating away) invalidates any
  // still-running poll from a previous one instead of leaving it to keep
  // hitting refreshUser in the background alongside a newer poll -- and
  // stops it from touching this component's own state after unmount.
  const generationRef = useRef(0);
  useEffect(() => {
    return () => {
      generationRef.current += 1;
    };
  }, []);

  const pollForReward = async (
    startingBalance: number,
    attempts: number,
    generation: number
  ): Promise<boolean> => {
    for (let i = 0; i < attempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, POSTBACK_POLL_INTERVAL_MS));
      if (generationRef.current !== generation) return false;
      const updated = await refreshUser();
      if (updated && updated.ticket_balance > startingBalance) return true;
      if (generationRef.current !== generation) return false;
    }
    return false;
  };

  // A signed, short-lived token standing in for the raw Telegram id --
  // Monetag relays whatever we hand it straight back in its postback with
  // no verification of its own, so the postback route checks this token's
  // signature instead of trusting a client-supplied id outright. Minted
  // fresh per ad (not reused across both) -- ymid is Monetag's own
  // per-impression tracking parameter, and handing it an identical value
  // for two separate ad requests in the same session is what was making
  // the second ad request silently fail instead of serving a real ad.
  // Plain fetch() has no timeout of its own -- on a slow connection it can
  // hang indefinitely with no error, which looked identical to "the second
  // ad just never happens". fetchWithRetry caps each attempt and retries
  // instead of hanging forever.
  const mintAdToken = async (): Promise<{ token: string | null; cooldownUntil?: string }> => {
    const tokenRes = await fetchWithRetry("/api/ads/mint-reward-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: getInitData() }),
    }).catch(() => null);
    const tokenData = await tokenRes?.json().catch(() => null);
    return { token: tokenData?.token ?? null, cooldownUntil: tokenData?.cooldownUntil };
  };

  const handleWatch = async () => {
    if (!user) return;
    // The other half of the guard in ad-session-lock: an automatic
    // interstitial is a full-screen ad, so this is hard to hit by hand, but
    // starting a rewarded watch while one is up would put two concurrent
    // calls into the same Monetag global -- the exact hazard the preload
    // comment below documents.
    if (isInterstitialActive()) return;
    const generation = (generationRef.current += 1);
    const startingBalance = user.ticket_balance;

    const { token: ymid1, cooldownUntil } = await mintAdToken();
    if (generationRef.current !== generation) return;
    if (!ymid1) {
      if (cooldownUntil) setAdCooldownUntil(cooldownUntil);
      return;
    }

    setStatus("ad1");

    // Only mint the second ad's token here (a plain API call, safe to run
    // alongside anything) -- do NOT call preloadAd yet. Monetag's SDK is a
    // single global function; calling it again for preload while it's
    // still in flight for ad1's showAd() below broke both ads outright,
    // not just the second one, since there's no indication the SDK
    // supports two concurrent calls to itself.
    const ymid2Promise = mintAdToken();

    if (!(await showAd(ymid1))) {
      if (generationRef.current === generation) setStatus("failed");
      return;
    }
    if (generationRef.current !== generation) return;
    // Ad 1 actually shown -- pushes the automatic interstitial's next
    // eligible moment out by another GAP_MS from here.
    markAdShown();

    setStatus("gap");
    // Now that ad1's own show() call has fully resolved, it's safe to
    // start preloading ad2's creative (Monetag's recommended pattern for
    // Rewarded Interstitials) -- this runs alongside the gap countdown
    // below, which is just a local timer, not another SDK call.
    const ymid2AndPreload = ymid2Promise.then(({ token }) => {
      if (token) preloadAd(token);
      return token;
    });
    for (let secondsLeft = AD_GAP_MS / 1000; secondsLeft > 0; secondsLeft--) {
      setGapSecondsLeft(secondsLeft);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (generationRef.current !== generation) return;

    const ymid2 = await ymid2AndPreload;
    if (generationRef.current !== generation) return;
    if (!ymid2) {
      // Rare: the cooldown kicked in between the two ads. ymid2Promise's own
      // cooldownUntil isn't threaded through here since preload only needs
      // the token, but the button un-sticking is what matters -- the next
      // tap's own mint call will surface the actual message.
      setStatus("failed");
      return;
    }

    setStatus("ad2");
    if (!(await showAd(ymid2))) {
      if (generationRef.current === generation) setStatus("failed");
      return;
    }
    if (generationRef.current !== generation) return;
    markAdShown();

    setStatus("checking");
    const rewardedQuickly = await pollForReward(startingBalance, POSTBACK_VISIBLE_ATTEMPTS, generation);
    if (generationRef.current !== generation) return;

    if (rewardedQuickly) {
      setStatus("done");
      setTimeout(() => {
        if (generationRef.current === generation) setStatus("idle");
      }, 2500);
      return;
    }

    // Not credited yet, but that doesn't mean it won't be -- hand the button
    // back and keep checking quietly. If the postback lands, refreshUser
    // updates the balance wherever it's shown; if it never does (the ad
    // genuinely wasn't valued), this just quietly stops.
    setStatus("idle");
    pollForReward(startingBalance, POSTBACK_BACKGROUND_ATTEMPTS, generation);
  };

  if (loadingUser) return <TaskRowSkeleton />;

  const hasPass = isPassActive(user?.raffly_pass_expires_at ?? null);
  const rewardLabel = hasPass ? "+1x2" : "+1";

  const label = inCooldown
    ? t("watchAd.cooldownLabel", { time: formatRemaining(cooldownRemainingMs) })
    : status === "ad1"
    ? t("watchAd.watchingAd1")
    : status === "gap"
    ? t("watchAd.nextAdIn", { n: gapSecondsLeft })
    : status === "ad2"
    ? t("watchAd.watchingAd2")
    : status === "checking"
    ? t("watchAd.checking")
    : status === "done"
    ? rewardLabel
    : status === "failed"
    ? t("watchAd.failedTryAgain")
    : t("watchAd.watch2Ads");

  // "failed" is a resting state like "idle", not an in-progress one -- the
  // button stays tappable so the retry the label asks for actually works
  // (tapping it re-runs handleWatch from the top, straight to "ad 1 of 2").
  const disabled = inCooldown || (status !== "idle" && status !== "failed");

  return (
    <TaskRow
      icon={<Image src="/images/watch-ads-icon.png" alt="" width={28} height={29} />}
      tone="orange"
      label={label}
      rewardLabel={rewardLabel}
      onClick={handleWatch}
      disabled={disabled}
    />
  );
}
