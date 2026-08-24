"use client";

import { useState } from "react";
import { useTelegram } from "@/components/providers/telegram-provider";
import { useLanguage } from "@/components/providers/language-provider";
import { TicketImage } from "@/components/ticket-image";
import { BuyRaffleModal } from "@/components/raffles/buy-raffle-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedTicketValue } from "@/components/animated-ticket-value";

export function BuyRaffleBar() {
  const { user, loadingUser } = useTelegram();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  if (loadingUser) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-[#151b2c] p-4">
        <Skeleton className="h-11 w-11 shrink-0 rounded-full bg-white/10" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-2.5 w-20 rounded-full bg-white/10" />
          <Skeleton className="mt-2 h-5 w-12 rounded-full bg-white/10" />
        </div>
        <Skeleton className="h-9 w-16 shrink-0 rounded-full bg-white/10" />
      </div>
    );
  }

  const balance = user?.ticket_balance ?? 0;

  return (
    <>
      <div className="flex items-center gap-3 rounded-2xl bg-[#151b2c] p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10">
          <TicketImage size={26} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-white/50">{t("buyRaffle.raffleTickets")}</p>
          <p className="font-heading text-xl font-bold text-white">
            <AnimatedTicketValue value={balance} />
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="btn-green flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold transition"
        >
          {t("buyRaffle.buy")}
          <TicketImage size={16} />
        </button>
      </div>
      {open && <BuyRaffleModal onClose={() => setOpen(false)} />}
    </>
  );
}
