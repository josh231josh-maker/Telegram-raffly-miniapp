"use client";

import { useState } from "react";
import { useMonetagAd } from "@/hooks/useMonetagAd";
import { useTelegram } from "@/components/providers/telegram-provider";
import { PlayCircleIcon } from "@/components/icons";
import { TaskRow } from "@/components/raffles/task-row";

export function WatchAdCard() {
  const { user, refreshUser, loadingUser } = useTelegram();
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const showAd = useMonetagAd();

  const handleWatch = async () => {
    if (!user) return;
    setStatus("loading");

    const success = await showAd(String(user.telegram_id));
    if (!success) {
      setStatus("idle");
      return;
    }

    setTimeout(async () => {
      await refreshUser();
      setStatus("done");
      setTimeout(() => setStatus("idle"), 2000);
    }, 2000);
  };

  if (loadingUser) return null;

  const label =
    status === "loading" ? "Processing..." : status === "done" ? "Ticket updated!" : "Watch Ad";

  return (
    <TaskRow
      icon={<PlayCircleIcon />}
      tone="orange"
      label={label}
      sublabel={status === "idle" ? "2 ads = 1 ticket" : undefined}
      rewardLabel="+1"
      onClick={handleWatch}
      disabled={status !== "idle"}
    />
  );
}
