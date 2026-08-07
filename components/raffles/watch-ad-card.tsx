"use client";

import { useState } from "react";
import { useAdsgram } from "@/hooks/useAdsgram";
import { useTelegram } from "@/components/providers/telegram-provider";
import { PlayCircleIcon } from "@/components/icons";
import { TaskRow } from "@/components/raffles/task-row";

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

  const label =
    status === "loading" ? "Processing..." : status === "done" ? "Ticket updated!" : "Watch 2 ads";

  return (
    <TaskRow
      icon={<PlayCircleIcon />}
      tone="gold"
      label={label}
      sublabel={status === "idle" ? "2 ads = 1 ticket" : undefined}
      rewardLabel="+1"
      onClick={showAd}
      disabled={status !== "idle"}
    />
  );
}
