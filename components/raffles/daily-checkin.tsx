"use client";

import { useState } from "react";
import { useTelegram } from "@/components/providers/telegram-provider";
import { isPassActive } from "@/lib/raffly-pass";
import { CalendarCheckIcon } from "@/components/icons";
import { TaskRow } from "@/components/raffles/task-row";

export function DailyCheckIn() {
  const { user, checkIn, loadingUser } = useTelegram();
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "already">("idle");
  const [ticketsEarned, setTicketsEarned] = useState<number | null>(null);

  if (loadingUser || !user) return null;

  const today = new Date().toISOString().slice(0, 10);
  const alreadyCheckedInToday = user.last_checkin_date === today;
  const disabled = alreadyCheckedInToday || status !== "idle";

  const nextBase = Math.min((user.streak_count ?? 0) + 1, 5);
  const nextReward = isPassActive(user.raffly_pass_expires_at) ? nextBase * 2 : nextBase;

  const handleCheckIn = async () => {
    setStatus("loading");
    const result = await checkIn();
    if (result.alreadyCheckedIn) {
      setStatus("already");
    } else if (result.user) {
      setTicketsEarned(result.ticketsEarned ?? null);
      setStatus("done");
    } else {
      setStatus("idle");
    }
  };

  const label =
    status === "loading"
      ? "Claiming..."
      : status === "done"
      ? `+${ticketsEarned} tickets claimed!`
      : alreadyCheckedInToday || status === "already"
      ? "Already claimed today"
      : "Daily Check-in";

  return (
    <TaskRow
      icon={<CalendarCheckIcon />}
      tone="purple"
      label={label}
      sublabel={
        disabled ? undefined : `Streak: ${user.streak_count ?? 0} day${(user.streak_count ?? 0) === 1 ? "" : "s"}`
      }
      rewardLabel={`+${nextReward}`}
      onClick={handleCheckIn}
      disabled={disabled}
    />
  );
}
