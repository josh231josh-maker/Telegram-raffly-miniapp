"use client";

import { useTelegram } from "@/components/providers/telegram-provider";
import { TicketIcon } from "@/components/icons";
import { IconBadge } from "@/components/icon-badge";

export function HomeHeader() {
  const { isTelegram } = useTelegram();

  return (
    <header className="flex flex-col items-center gap-1.5 pb-1 text-center">
      <div className="flex items-center gap-2">
        <IconBadge icon={<TicketIcon />} tone="gold" size="sm" />
        <h1 className="font-heading text-2xl font-bold text-text">Raffly</h1>
      </div>
      {!isTelegram && (
        <p className="mt-1 rounded-full border border-gold/30 bg-gold-soft px-3 py-1 text-[11px] text-gold">
          Dev mode — open in Telegram for full experience
        </p>
      )}
    </header>
  );
}
