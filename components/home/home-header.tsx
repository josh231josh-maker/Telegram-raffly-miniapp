"use client";

import { useTelegram } from "@/components/providers/telegram-provider";

export function HomeHeader() {
  const { isTelegram } = useTelegram();

  if (isTelegram) return null;

  return (
    <p className="mx-auto rounded-full border border-gold/30 bg-gold-soft px-3 py-1 text-[11px] text-gold">
      Dev mode — open in Telegram for full experience
    </p>
  );
}
