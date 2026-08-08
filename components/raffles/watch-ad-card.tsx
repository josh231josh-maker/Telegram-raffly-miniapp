"use client";

import { useState } from "react";
import { useMonetagAd } from "@/hooks/useMonetagAd";
import { useTelegram } from "@/components/providers/telegram-provider";
import { isPassActive } from "@/lib/raffly-pass";
import { PlayCircleIcon } from "@/components/icons";
import { TaskRow } from "@/components/raffles/task-row";
import { TaskRowSkeleton } from "@/components/raffles/task-row-skeleton";

type Status = "idle" | "ad1" | "ad2" | "checking" | "done" | "no-reward";

// Gives Monetag's postback time to arrive before we check whether the balance actually changed.
const POSTBACK_WAIT_MS = 2500;

export function WatchAdCard() {
  const { user, refreshUser, loadingUser } = useTelegram();
  const [status, setStatus] = useState<Status>("idle");
  const showAd = useMonetagAd();

  const handleWatch = async () => {
    if (!user) return;
    const startingBalance = user.ticket_balance;
    const ymid = String(user.telegram_id);

    setStatus("ad1");
    if (!(await showAd(ymid, "pop"))) {
      setStatus("idle");
      return;
    }

    setStatus("ad2");
    if (!(await showAd(ymid))) {
      setStatus("idle");
      return;
    }

    setStatus("checking");
    await new Promise((resolve) => setTimeout(resolve, POSTBACK_WAIT_MS));
    const updated = await refreshUser();

    setStatus(updated && updated.ticket_balance > startingBalance ? "done" : "no-reward");
    setTimeout(() => setStatus("idle"), 2500);
  };

  if (loadingUser) return <TaskRowSkeleton />;

  const hasPass = isPassActive(user?.raffly_pass_expires_at ?? null);
  const rewardLabel = hasPass ? "+1x2" : "+1";

  const label =
    status === "ad1"
      ? "Watching ad 1 of 2..."
      : status === "ad2"
      ? "Watching ad 2 of 2..."
      : status === "checking"
      ? "Checking..."
      : status === "done"
      ? rewardLabel
      : status === "no-reward"
      ? "No reward yet"
      : "Watch Ad";

  return (
    <TaskRow
      icon={<PlayCircleIcon />}
      tone="orange"
      label={label}
      sublabel={status === "idle" ? "2 ads = 1 ticket" : undefined}
      rewardLabel={rewardLabel}
      onClick={handleWatch}
      disabled={status !== "idle"}
    />
  );
}
