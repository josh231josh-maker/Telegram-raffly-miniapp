"use client";

import { useState } from "react";
import { useMonetagAd } from "@/hooks/useMonetagAd";
import { useTelegram } from "@/components/providers/telegram-provider";
import { isPassActive } from "@/lib/raffly-pass";
import { PlayCircleIcon } from "@/components/icons";
import { TaskRow } from "@/components/raffles/task-row";
import { TaskRowSkeleton } from "@/components/raffles/task-row-skeleton";

type Status = "idle" | "ad1" | "gap" | "ad2" | "checking" | "done";

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
  const showAd = useMonetagAd();

  const pollForReward = async (startingBalance: number, attempts: number): Promise<boolean> => {
    for (let i = 0; i < attempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, POSTBACK_POLL_INTERVAL_MS));
      const updated = await refreshUser();
      if (updated && updated.ticket_balance > startingBalance) return true;
    }
    return false;
  };

  const handleWatch = async () => {
    if (!user) return;
    const startingBalance = user.ticket_balance;

    // A signed, short-lived token standing in for the raw Telegram id --
    // Monetag relays whatever we hand it straight back in its postback with
    // no verification of its own, so the postback route checks this token's
    // signature instead of trusting a client-supplied id outright.
    const tokenRes = await fetch("/api/ads/mint-reward-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: getInitData() }),
    }).catch(() => null);
    const tokenData = await tokenRes?.json().catch(() => null);
    const ymid = tokenData?.token;
    if (!ymid) return;

    setStatus("ad1");
    if (!(await showAd(ymid))) {
      setStatus("idle");
      return;
    }

    setStatus("gap");
    for (let secondsLeft = AD_GAP_MS / 1000; secondsLeft > 0; secondsLeft--) {
      setGapSecondsLeft(secondsLeft);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    setStatus("ad2");
    if (!(await showAd(ymid))) {
      setStatus("idle");
      return;
    }

    setStatus("checking");
    const rewardedQuickly = await pollForReward(startingBalance, POSTBACK_VISIBLE_ATTEMPTS);

    if (rewardedQuickly) {
      setStatus("done");
      setTimeout(() => setStatus("idle"), 2500);
      return;
    }

    // Not credited yet, but that doesn't mean it won't be -- hand the button
    // back and keep checking quietly. If the postback lands, refreshUser
    // updates the balance wherever it's shown; if it never does (the ad
    // genuinely wasn't valued), this just quietly stops.
    setStatus("idle");
    pollForReward(startingBalance, POSTBACK_BACKGROUND_ATTEMPTS);
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
      : "Watch 2 Ads";

  return (
    <TaskRow
      icon={<PlayCircleIcon />}
      tone="orange"
      label={label}
      rewardLabel={rewardLabel}
      onClick={handleWatch}
      disabled={status !== "idle"}
    />
  );
}
