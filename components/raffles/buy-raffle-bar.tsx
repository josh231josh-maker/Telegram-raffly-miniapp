"use client";

import { useState } from "react";
import { useTelegram } from "@/components/providers/telegram-provider";
import { TicketImage } from "@/components/ticket-image";
import { BuyRaffleModal } from "@/components/raffles/buy-raffle-modal";

export function BuyRaffleBar() {
  const { user, loadingUser } = useTelegram();
  const [open, setOpen] = useState(false);

  if (loadingUser) return null;

  const balance = user?.ticket_balance ?? 0;

  return (
    <>
      <div className="flex items-center gap-3 rounded-2xl bg-[#151b2c] p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10">
          <TicketImage size={26} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-white/50">Raffle tickets</p>
          <p className="font-heading text-xl font-bold text-white">{balance}</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="btn-green flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold transition"
        >
          Buy
          <TicketImage size={16} />
        </button>
      </div>
      {open && <BuyRaffleModal onClose={() => setOpen(false)} />}
    </>
  );
}
