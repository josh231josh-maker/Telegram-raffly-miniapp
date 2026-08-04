"use client";

import { useState } from "react";
import { useTelegram } from "@/components/providers/telegram-provider";

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
    <section className="card-glow rounded-2xl border border-gold/20 bg-card p-5 backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-indigo-200/70">Daily Check-in</span>
        <span className="text-xs text-indigo-200/50">
          Streak: {user?.streak_count ?? 0} day{(user?.streak_count ?? 0) === 1 ? "" : "s"}
        </span>
      </div>
      <button
        onClick={handleCheckIn}
        disabled={disabled}
        className="w-full rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-indigo-950 transition disabled:cursor-not-allowed disabled:opacity-50"
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