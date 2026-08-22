"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useAdsgramAd } from "@/hooks/useAdsgram";
import { useTelegram } from "@/components/providers/telegram-provider";
import { isPassActive } from "@/lib/raffly-pass";
import { fetchWithRetry } from "@/lib/fetch-retry";
import { TaskRow } from "@/components/raffles/task-row";
import { TaskRowSkeleton } from "@/components/raffles/task-row-skeleton";

type Status = "idle" | "watching" | "checking" | "done" | "failed";

// AdsGram's reward postback lands server-to-server, separately from the
// client's own show() promise resolving -- same "don't trust the SDK
// callback as proof of a credited reward" rule as Monetag/TADS, so this
// polls for an actual balance change instead of crediting on show() alone.
const POSTBACK_POLL_INTERVAL_MS = 700;
const POSTBACK_VISIBLE_ATTEMPTS = 12;
const POSTBACK_BACKGROUND_ATTEMPTS = 40;

function formatCooldown(cooldownUntil: string): string {
  const remainingMs = new Date(cooldownUntil).getTime() - Date.now();
  const minutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  if (minutes < 60) return `Come back in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `Come back in ${hours}h ${mins}m` : `Come back in ${hours}h`;
}

export function WatchAdsgramAdCard() {
  const { user, refreshUser, loadingUser, getInitData } = useTelegram();
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const { showAd } = useAdsgramAd();

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

  // AdsGram's SDK has no server round-trip before showing an ad (unlike
  // Monetag, which mints a token first), so there's no natural place to
  // learn about an active cooldown before wasting the user's time watching
  // an ad that won't credit anything. Piggybacking on mint-reward-token
  // purely for its cooldown check (the token itself goes unused here) is
  // cheap and reuses code already proven correct, rather than adding a
  // second endpoint that does the same lookup.
  const checkCooldown = async (): Promise<string | null> => {
    const res = await fetchWithRetry("/api/ads/mint-reward-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: getInitData() }),
    }).catch(() => null);
    if (res?.status !== 429) return null;
    const data = await res.json().catch(() => null);
    return data?.cooldownUntil ?? null;
  };

  const handleWatch = async () => {
    if (!user) return;
    const generation = (generationRef.current += 1);
    const startingBalance = user.ticket_balance;
    setMessage(null);

    const cooldownUntil = await checkCooldown();
    if (generationRef.current !== generation) return;
    if (cooldownUntil) {
      setMessage(formatCooldown(cooldownUntil));
      return;
    }

    setStatus("watching");
    const shown = await showAd();
    if (generationRef.current !== generation) return;
    if (!shown) {
      setStatus("failed");
      return;
    }

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
    // back and keep checking quietly, same as WatchAdCard.
    setStatus("idle");
    pollForReward(startingBalance, POSTBACK_BACKGROUND_ATTEMPTS, generation);
  };

  if (loadingUser) return <TaskRowSkeleton />;

  const hasPass = isPassActive(user?.raffly_pass_expires_at ?? null);
  const rewardLabel = hasPass ? "+1x2" : "+1";

  const label =
    status === "watching"
      ? "Watching ad..."
      : status === "checking"
      ? "Checking..."
      : status === "done"
      ? rewardLabel
      : status === "failed"
      ? "Failed, try again"
      : "Watch Ad";

  const disabled = status !== "idle" && status !== "failed";

  return (
    <div>
      <TaskRow
        icon={<Image src="/images/watch-ads-icon.png" alt="" width={28} height={29} />}
        tone="orange"
        label={label}
        rewardLabel={rewardLabel}
        onClick={handleWatch}
        disabled={disabled}
      />
      {message && <p className="mt-1 px-2 text-xs text-text-faint">{message}</p>}
    </div>
  );
}
