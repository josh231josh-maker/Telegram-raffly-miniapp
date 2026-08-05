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
    <section className="card-glow rounded-2xl border border-gold/20 bg-card p-5 backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-indigo-200/70">Watch & Earn</span>
        <span className="text-xs text-indigo-200/50">2 ads = 1 ticket</span>
      </div>
      <button
        onClick={showAd}
        disabled={status !== "idle"}
        className="w-full rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-indigo-950 transition disabled:cursor-not-allowed disabled:opacity-50"
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