"use client";

import { useState } from "react";
import { useAdsgram } from "@/hooks/useAdsgram";
import { useTelegram } from "@/components/providers/telegram-provider";

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
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-text-dim">Watch & Earn</span>
        <span className="text-xs text-text-faint">2 ads = 1 ticket</span>
      </div>
      <button
        onClick={showAd}
        disabled={status !== "idle"}
        className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
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
