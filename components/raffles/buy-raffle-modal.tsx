"use client";

import { useState } from "react";
import { useTelegram } from "@/components/providers/telegram-provider";
import { useTelegramInvoice } from "@/hooks/useTelegramInvoice";
import { CloseIcon, StarIcon } from "@/components/icons";
import { TicketImage } from "@/components/ticket-image";

// pay `stars`, receive `tickets` — first number in each pair is the star cost
const TIERS = [
  { id: "raffle10", stars: 10, tickets: 12 },
  { id: "raffle50", stars: 50, tickets: 70 },
  { id: "raffle100", stars: 100, tickets: 150 },
  { id: "raffle250", stars: 250, tickets: 400 },
  { id: "raffle500", stars: 500, tickets: 850 },
  { id: "raffle1000", stars: 1000, tickets: 1800 },
];

type BuyRaffleModalProps = {
  onClose: () => void;
};

export function BuyRaffleModal({ onClose }: BuyRaffleModalProps) {
  const { user, refreshUser, getInitData } = useTelegram();
  const openInvoice = useTelegramInvoice();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const balance = user?.ticket_balance ?? 0;

  const handleBuy = async (tierId: string) => {
    setMessage(null);
    setLoadingTier(tierId);
    try {
      const res = await fetch("/api/stars/create-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: getInitData(), tier: tierId }),
      });
      const data = await res.json();
      if (!data.invoiceUrl) {
        setMessage(data.error ?? "Could not start payment");
        setLoadingTier(null);
        return;
      }

      const status = await openInvoice(data.invoiceUrl);
      if (status === "paid") {
        setMessage("Payment successful! Raffle tickets added.");
        setTimeout(() => refreshUser(), 1500);
      } else if (status === "cancelled") {
        setMessage("Payment cancelled");
      } else if (status !== "pending") {
        setMessage("Payment did not complete");
      }
    } catch {
      setMessage("Something went wrong");
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full rounded-t-3xl bg-[#12141f] p-5"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 22px)" }}
      >
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm text-white/70">
            Balance
            <TicketImage size={16} />
            <span className="font-semibold text-white">{balance}</span>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70"
            aria-label="Close"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex flex-col items-center py-3">
          <TicketImage size={56} />
          <h2 className="mt-3 font-heading text-xl font-bold text-white">Top Up Raffle</h2>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {TIERS.map((t) => (
            <button
              key={t.id}
              onClick={() => handleBuy(t.id)}
              disabled={loadingTier !== null}
              className="flex flex-col items-center gap-1 rounded-2xl bg-white/5 px-2 py-3.5 transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              <TicketImage size={34} />
              <span className="font-heading text-base font-bold text-white">{t.tickets}</span>
              <span className="text-[10px] text-white/45">raffle</span>
              <span className="mt-1 flex items-center gap-1 rounded-full bg-accent/20 px-2 py-1 text-[11px] font-semibold text-accent-2">
                {loadingTier === t.id ? "..." : t.stars}
                <StarIcon className="h-2.5 w-2.5" />
              </span>
            </button>
          ))}
        </div>

        {message && <p className="mt-3 text-center text-xs text-white/60">{message}</p>}
      </div>
    </div>
  );
}
