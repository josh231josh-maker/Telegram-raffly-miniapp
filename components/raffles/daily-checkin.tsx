"use client";

import { useState } from "react";
import { useTelegram } from "@/components/providers/telegram-provider";
import { CalendarCheckIcon } from "@/components/icons";
import { IconBadge } from "@/components/icon-badge";

export function DailyCheckIn() {
  const { user, checkIn, loadingUser } = useTelegram();
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "already">("idle");
  const [ticketsEarned, setTicketsEarned] = useState<number | null>(null);

  if (loadingUser) return null;

  const today = new Date().toISOString().slice(0, 10);
  const alreadyCheckedInToday = user?.last_checkin_date === today;

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

  const disabled =
    alreadyCheckedInToday || status === "loading" || status === "done" || status === "already";

  return (
    <section className="card-soft rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <IconBadge icon={<CalendarCheckIcon />} tone="accent" size="sm" />
          <span className="text-sm font-medium text-text-dim">Daily Check-in</span>
        </div>
        <span className="text-xs text-text-faint">
          Streak: {user?.streak_count ?? 0} day{(user?.streak_count ?? 0) === 1 ? "" : "s"}
        </span>
      </div>
      <button
        onClick={handleCheckIn}
        disabled={disabled}
        className="btn-accent w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
      >
        {alreadyCheckedInToday || status === "already"
          ? "Already claimed today"
          : status === "loading"
          ? "Claiming..."
          : status === "done"
          ? `+${ticketsEarned} tickets claimed!`
          : "Claim today's tickets"}
      </button>
    </section>
  );
}
