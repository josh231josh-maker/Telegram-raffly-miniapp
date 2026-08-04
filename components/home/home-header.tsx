"use client";

import { useTelegram } from "@/components/providers/telegram-provider";

export function HomeHeader() {
  const { isTelegram } = useTelegram();

  return (
    <header className="flex flex-col items-center gap-2 text-center">
      <div className="flex items-center gap-2">
        <span className="text-2xl" aria-hidden="true">
          🎟️
        </span>
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="gold-text">Raffly</span>
        </h1>
        <span className="text-2xl" aria-hidden="true">
          ⭐
        </span>
      </div>
      <p className="text-sm text-indigo-200/80">
        5 winners · $100 USDT each · every week
      </p>
      {!isTelegram && (
        <p className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs text-amber-200">
          Dev mode — open in Telegram for full experience
        </p>
      )}
    </header>
  );
}
