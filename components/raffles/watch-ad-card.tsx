"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useMonetagAd } from "@/hooks/useMonetagAd";
import { useTelegram } from "@/components/providers/telegram-provider";
import { isPassActive } from "@/lib/raffly-pass";
import { fetchWithRetry } from "@/lib/fetch-retry";
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

export function WatchAdCard() {
  const { user, refreshUser, loadingUser, getInitData } = useTelegram();
  const [status, setStatus] = useState<Status>("idle");
  const [gapSecondsLeft, setGapSecondsLeft] = useState(0);
  const { preloadAd, showAd } = useMonetagAd();

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
  const mintAdToken = async (): Promise<string | null> => {
    const tokenRes = await fetchWithRetry("/api/ads/mint-reward-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: getInitData() }),
    }).catch(() => null);
    const tokenData = await tokenRes?.json().catch(() => null);
    return tokenData?.token ?? null;
  };

  const handleWatch = async () => {
    if (!user) return;
    const generation = (generationRef.current += 1);
    const startingBalance = user.ticket_balance;

    const ymid1 = await mintAdToken();
    if (!ymid1 || generationRef.current !== generation) return;

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

    setStatus("gap");
    // Now that ad1's own show() call has fully resolved, it's safe to
    // start preloading ad2's creative (Monetag's recommended pattern for
    // Rewarded Interstitials) -- this runs alongside the gap countdown
    // below, which is just a local timer, not another SDK call.
    const ymid2AndPreload = ymid2Promise.then((ymid2) => {
      if (ymid2) preloadAd(ymid2);
      return ymid2;
    });
    for (let secondsLeft = AD_GAP_MS / 1000; secondsLeft > 0; secondsLeft--) {
      setGapSecondsLeft(secondsLeft);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (generationRef.current !== generation) return;

    const ymid2 = await ymid2AndPreload;
    if (!ymid2 || generationRef.current !== generation) return;

    setStatus("ad2");
    if (!(await showAd(ymid2))) {
      if (generationRef.current === generation) setStatus("failed");
      return;
    }
    if (generationRef.current !== generation) return;

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

  const label =
    status === "ad1"
      ? "Watching ad 1 of 2..."
      : status === "gap"
      ? `Next ad in ${gapSecondsLeft}s...`
      : status === "ad2"
      ? "Watching ad 2 of 2..."
      : status === "checking"
      ? "Checking..."
      : status === "done"
      ? rewardLabel
      : status === "failed"
      ? "Failed, try again"
      : "Watch 2 Ads";

  // "failed" is a resting state like "idle", not an in-progress one -- the
  // button stays tappable so the retry the label asks for actually works
  // (tapping it re-runs handleWatch from the top, straight to "ad 1 of 2").
  const disabled = status !== "idle" && status !== "failed";

  return (
    <TaskRow
      icon={<Image src="/images/watch-ads-icon.png" alt="" width={36} height={37} />}
      plainIcon
      tone="orange"
      label={label}
      rewardLabel={rewardLabel}
      onClick={handleWatch}
      disabled={disabled}
    />
  );
}
