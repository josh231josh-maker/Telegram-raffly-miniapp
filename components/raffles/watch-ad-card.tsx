"use client";

import { useState } from "react";
import { useAdsgram } from "@/hooks/useAdsgram";
import { useTelegram } from "@/components/providers/telegram-provider";
import { PlayCircleIcon } from "@/components/icons";
import { IconBadge } from "@/components/icon-badge";

const ADSGRAM_BLOCK_ID = "41260";

export function WatchAdCard() {
  const { refreshUser, loadingUser } = useTelegram();
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");

  const showAd = useAdsgram({
    blockId: ADSGRAM_BLOCK_ID,
    onReward: async () => {
      setStatus("loading");
      setTimeout(async () => {
        await refreshUser();
        setStatus("done");
        setTimeout(() => setStatus("idle"), 2000);
      }, 1500);
    },
    onError: () => {
      setStatus("idle");
    },
  });

  if (loadingUser) return null;

  return (
    <section className="card-soft rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <IconBadge icon={<PlayCircleIcon />} tone="accent" size="sm" />
          <span className="text-sm font-medium text-text-dim">Watch & Earn</span>
        </div>
        <span className="text-xs text-text-faint">2 ads = 1 ticket</span>
      </div>
      <button
        onClick={showAd}
        disabled={status !== "idle"}
        className="btn-accent w-full rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
      >
        {status === "loading"
          ? "Processing..."
          : status === "done"
          ? "Ticket updated!"
          : "Watch Ad"}
      </button>
    </section>
  );
}
