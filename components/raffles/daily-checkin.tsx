"use client";

import { useState } from "react";
import Image from "next/image";
import { useTelegram } from "@/components/providers/telegram-provider";
import { useLanguage } from "@/components/providers/language-provider";
import { isPassActive } from "@/lib/raffly-pass";
import { TaskRow } from "@/components/raffles/task-row";
import { TaskRowSkeleton } from "@/components/raffles/task-row-skeleton";

export function DailyCheckIn() {
  const { user, checkIn, loadingUser } = useTelegram();
  const { t } = useLanguage();
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [message, setMessage] = useState<string | null>(null);

  if (loadingUser || !user) return <TaskRowSkeleton />;

  const today = new Date().toISOString().slice(0, 10);
  // Claimed today -- shows in the Completed section instead (see
  // CompletedTasksSection), same as any other finished task.
  if (user.last_checkin_date === today) return null;

  // The stored streak_count only actually resets server-side the next time
  // the user checks in (try_daily_checkin recomputes it then, same
  // yesterday check as below) -- until that happens, a missed day leaves
  // streak_count stale on the user row. Mirroring that same "is the streak
  // still alive" check here means the preview shown before tapping matches
  // what tapping will actually do, instead of showing an already-broken
  // streak as if it were still intact.
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const streakAlive = user.last_checkin_date === yesterday;
  const currentStreak = streakAlive ? user.streak_count ?? 0 : 0;

  const hasPass = isPassActive(user.raffly_pass_expires_at);
  // Mirrors the server's 7-day cycle (app/api/checkin/route.ts): +1 through
  // +7, then back to +1 -- not a clamp, or the preview would get stuck
  // showing +7 forever once a full week's been claimed.
  const nextBase = (currentStreak % 7) + 1;
  const rewardLabel = hasPass ? `+${nextBase}x2` : `+${nextBase}`;

  const handleCheckIn = async () => {
    setMessage(null);
    setStatus("loading");
    const result = await checkIn();
    setStatus("idle");
    // On success, user.last_checkin_date updates via context and the early
    // return above hides this row on the next render -- moving into the
    // Completed section is the feedback, same as Join Channel's "Already Did".
    if (result.error) {
      setMessage(result.error);
    }
  };

  return (
    <>
      <TaskRow
        icon={<Image src="/images/daily-checkin-icon.png" alt="" width={28} height={29} />}
        tone="purple"
        label={status === "loading" ? t("dailyCheckin.claiming") : t("dailyCheckin.label")}
        sublabel={t(currentStreak === 1 ? "dailyCheckin.streakOne" : "dailyCheckin.streakMany", {
          n: currentStreak,
        })}
        rewardLabel={rewardLabel}
        onClick={handleCheckIn}
        disabled={status === "loading"}
      />
      {message && <p className="mt-1 px-2 text-xs text-text-faint">{message}</p>}
    </>
  );
}
