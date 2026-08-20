"use client";

import { useState } from "react";
import { useTelegram } from "@/components/providers/telegram-provider";
import { useTelegramBackButton } from "@/hooks/useTelegramBackButton";
import { isPassActive } from "@/lib/raffly-pass";
import { TicketImage } from "@/components/ticket-image";
import { CloseIcon } from "@/components/icons";

type DailyCheckInPopupProps = {
  onClose: () => void;
};

// Mirrors DailyCheckIn's own reward math exactly (lib nowhere shares this as
// a helper -- both derive it straight from streak_count) so the preview
// shown here always matches what tapping Claim actually pays out.
const MAX_STREAK_DAY = 5;

export function DailyCheckInPopup({ onClose }: DailyCheckInPopupProps) {
  const { user, checkIn } = useTelegram();
  useTelegramBackButton(onClose);
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [message, setMessage] = useState<string | null>(null);

  if (!user) return null;

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const streakAlive = user.last_checkin_date === today || user.last_checkin_date === yesterday;
  const currentStreak = streakAlive ? user.streak_count ?? 0 : 0;
  const nextDay = Math.min(currentStreak + 1, MAX_STREAK_DAY);

  const hasPass = isPassActive(user.raffly_pass_expires_at);
  const rewardFor = (day: number) => (hasPass ? day * 2 : day);

  const handleClaim = async () => {
    setMessage(null);
    setStatus("loading");
    const result = await checkIn();
    setStatus("idle");
    if (result.error) {
      setMessage(result.error);
    } else {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5"
      onClick={onClose}
    >
      <div
        className="card-purple w-full max-w-sm rounded-[28px] p-5 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-heading text-xl font-bold text-balance">Daily Check-in</h2>
            <p className="mt-0.5 text-xs text-white/70">
              Streak: {currentStreak} day{currentStreak === 1 ? "" : "s"}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {Array.from({ length: MAX_STREAK_DAY }, (_, i) => MAX_STREAK_DAY - i).map((day) => {
            const isNext = day === nextDay;
            return (
              <div
                key={day}
                className={`flex items-center justify-between rounded-2xl px-4 py-2.5 transition ${
                  isNext ? "bg-white/25 ring-2 ring-white" : "bg-white/10"
                }`}
              >
                <span className="flex items-center gap-2.5 text-sm font-semibold">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
                      isNext ? "bg-white text-purple" : "bg-white/20 text-white/80"
                    }`}
                  >
                    {day}
                  </span>
                  Day {day}
                </span>
                <span className="flex shrink-0 items-center gap-1 text-sm font-bold tabular-nums">
                  +{rewardFor(day)}
                  <TicketImage size={16} />
                </span>
              </div>
            );
          })}
        </div>

        <button
          onClick={handleClaim}
          disabled={status === "loading"}
          className="mt-5 w-full rounded-full bg-white px-4 py-3 text-sm font-bold text-purple shadow-lg transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "loading" ? "Claiming..." : `Claim +${rewardFor(nextDay)} tickets`}
        </button>
        {message && <p className="mt-2 text-center text-xs text-white/70">{message}</p>}
      </div>
    </div>
  );
}
