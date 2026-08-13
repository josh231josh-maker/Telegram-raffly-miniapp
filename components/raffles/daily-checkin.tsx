"use client";

import { useState } from "react";
import Image from "next/image";
import { useTelegram } from "@/components/providers/telegram-provider";
import { isPassActive } from "@/lib/raffly-pass";
import { TaskRow } from "@/components/raffles/task-row";
import { TaskRowSkeleton } from "@/components/raffles/task-row-skeleton";

export function DailyCheckIn() {
  const { user, checkIn, loadingUser } = useTelegram();
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "already">("idle");
  const [claimedLabel, setClaimedLabel] = useState<string | null>(null);

  if (loadingUser || !user) return <TaskRowSkeleton />;

  const today = new Date().toISOString().slice(0, 10);
  const alreadyCheckedInToday = user.last_checkin_date === today;
  const disabled = alreadyCheckedInToday || status !== "idle";

  const hasPass = isPassActive(user.raffly_pass_expires_at);
  const nextBase = Math.min((user.streak_count ?? 0) + 1, 5);
  const rewardLabel = hasPass ? `+${nextBase}x2` : `+${nextBase}`;

  const handleCheckIn = async () => {
    setStatus("loading");
    setClaimedLabel(rewardLabel);
    const result = await checkIn();
    if (result.alreadyCheckedIn) {
      setStatus("already");
    } else if (result.user) {
      setStatus("done");
    } else {
      setStatus("idle");
    }
  };

  const label =
    status === "loading"
      ? "Claiming..."
      : status === "done"
      ? `${claimedLabel} tickets claimed!`
      : alreadyCheckedInToday || status === "already"
      ? "Already claimed today"
      : "Daily Check-in";

  return (
    <TaskRow
      icon={<Image src="/images/daily-checkin-icon.png" alt="" width={36} height={37} />}
      tone="purple"
      label={label}
      sublabel={
        disabled ? undefined : `Streak: ${user.streak_count ?? 0} day${(user.streak_count ?? 0) === 1 ? "" : "s"}`
      }
      rewardLabel={rewardLabel}
      onClick={handleCheckIn}
      disabled={disabled}
    />
  );
}
