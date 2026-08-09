"use client";

import { useState } from "react";
import { useMonetagAd } from "@/hooks/useMonetagAd";
import { useTelegram } from "@/components/providers/telegram-provider";
import { isPassActive } from "@/lib/raffly-pass";
import { PlayCircleIcon } from "@/components/icons";
import { TaskRow } from "@/components/raffles/task-row";
import { TaskRowSkeleton } from "@/components/raffles/task-row-skeleton";

type Status = "idle" | "ad1" | "gap" | "ad2" | "checking" | "done" | "no-reward";

// Pause between the two ads so the second doesn't feel like it's firing on
// top of the first.
const AD_GAP_MS = 3000;

// Polls for the postback's credit instead of one blind wait-then-check --
// picks up a fast postback in well under a second instead of always paying
// the full wait, while still tolerating a slow one up to the cap below.
const POSTBACK_POLL_INTERVAL_MS = 700;
const POSTBACK_MAX_ATTEMPTS = 12;

export function WatchAdCard() {
  const { user, refreshUser, loadingUser } = useTelegram();
  const [status, setStatus] = useState<Status>("idle");
  const [gapSecondsLeft, setGapSecondsLeft] = useState(0);
  const showAd = useMonetagAd();

  const waitForReward = async (startingBalance: number): Promise<boolean> => {
    for (let i = 0; i < POSTBACK_MAX_ATTEMPTS; i++) {
      await new Promise((resolve) => setTimeout(resolve, POSTBACK_POLL_INTERVAL_MS));
      const updated = await refreshUser();
      if (updated && updated.ticket_balance > startingBalance) return true;
    }
    return false;
  };

  const handleWatch = async () => {
    if (!user) return;
    const startingBalance = user.ticket_balance;
    const ymid = String(user.telegram_id);

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
    const rewarded = await waitForReward(startingBalance);

    setStatus(rewarded ? "done" : "no-reward");
    setTimeout(() => setStatus("idle"), 2500);
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
      : status === "no-reward"
      ? "Ad not rewarded"
      : "Watch Ad";

  return (
    <TaskRow
      icon={<PlayCircleIcon />}
      tone="orange"
      label={label}
      sublabel={
        status === "idle"
          ? "2 ads = 1 ticket"
          : status === "no-reward"
          ? "One of the ads didn't qualify — try again"
          : undefined
      }
      rewardLabel={rewardLabel}
      onClick={handleWatch}
      disabled={status !== "idle"}
    />
  );
}
