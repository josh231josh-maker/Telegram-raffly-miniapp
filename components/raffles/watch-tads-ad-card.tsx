"use client";

import { useState } from "react";
import Image from "next/image";
import { useTadsAd } from "@/hooks/useTadsAd";
import { useTelegram } from "@/components/providers/telegram-provider";
import { isPassActive } from "@/lib/raffly-pass";
import { TaskRow } from "@/components/raffles/task-row";
import { TaskRowSkeleton } from "@/components/raffles/task-row-skeleton";

type Status = "idle" | "watching" | "checking" | "failed";

// TADS' postback isn't wired up to credit tickets yet (Phase 1 -- see
// app/api/ads/tads-postback/route.ts). onShowReward firing is not itself
// proof of a server-verified reward, so this doesn't grant anything
// directly -- it just refreshes the user shortly after, the same way the
// rest of the app only ever trusts a balance change it fetched from the
// server, never a client-side ad SDK callback.
const REFRESH_DELAY_MS = 2000;

export function WatchTadsAdCard() {
  const { user, refreshUser, loadingUser } = useTelegram();
  const [status, setStatus] = useState<Status>("idle");
  const { showAd } = useTadsAd();

  const handleWatch = async () => {
    setStatus("watching");
    const shown = await showAd();
    if (!shown) {
      setStatus("failed");
      return;
    }
    setStatus("checking");
    setTimeout(() => {
      refreshUser();
      setStatus("idle");
    }, REFRESH_DELAY_MS);
  };

  if (loadingUser) return <TaskRowSkeleton />;

  const hasPass = isPassActive(user?.raffly_pass_expires_at ?? null);
  const rewardLabel = hasPass ? "+1x2" : "+1";

  const label =
    status === "watching"
      ? "Watching ad..."
      : status === "checking"
      ? "Checking..."
      : status === "failed"
      ? "Failed, try again"
      : "Watch Ad";

  // "failed" is a resting state like "idle", not in-progress -- see
  // watch-ad-card.tsx for why the button stays tappable in it.
  const disabled = status !== "idle" && status !== "failed";

  return (
    <TaskRow
      icon={<Image src="/images/watch-ads-icon.png" alt="" width={36} height={37} />}
      tone="orange"
      label={label}
      rewardLabel={rewardLabel}
      onClick={handleWatch}
      disabled={disabled}
    />
  );
}
