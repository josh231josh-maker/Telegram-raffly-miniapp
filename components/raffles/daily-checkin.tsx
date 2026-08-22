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
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const alreadyCheckedInToday = user.last_checkin_date === today;
  const disabled = alreadyCheckedInToday || status !== "idle";

  // The stored streak_count only actually resets server-side the next time
  // the user checks in (try_daily_checkin recomputes it then, same
  // yesterday/not-yesterday check as below) -- until that happens, a missed
  // day leaves streak_count stale on the user row. Mirroring that same
  // "is the streak still alive" check here means the preview shown before
  // tapping matches what tapping will actually do, instead of showing an
  // already-broken streak as if it were still intact.
  const streakAlive = alreadyCheckedInToday || user.last_checkin_date === yesterday;
  const currentStreak = streakAlive ? user.streak_count ?? 0 : 0;

  const hasPass = isPassActive(user.raffly_pass_expires_at);
  // Mirrors the server's 7-day cycle (app/api/checkin/route.ts): +1 through
  // +7, then back to +1 -- not a clamp, or the preview would get stuck
  // showing +7 forever once a full week's been claimed.
  const nextBase = (currentStreak % 7) + 1;
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
      icon={<Image src="/images/daily-checkin-icon.png" alt="" width={28} height={29} />}
      tone="purple"
      label={label}
      sublabel={
        disabled ? undefined : `Streak: ${currentStreak} day${currentStreak === 1 ? "" : "s"}`
      }
      rewardLabel={rewardLabel}
      onClick={handleCheckIn}
      disabled={disabled}
    />
  );
}
