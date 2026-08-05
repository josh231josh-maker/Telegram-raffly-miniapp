"use client";

import { useState } from "react";
import { useTelegram } from "@/components/providers/telegram-provider";
import { useTelegramInvoice } from "@/hooks/useTelegramInvoice";

const TIERS = [
  { id: "entry", stars: 10, tickets: 15, label: "Entry Pack" },
  { id: "better", stars: 50, tickets: 90, label: "Better Value" },
  { id: "best", stars: 100, tickets: 200, label: "Best Value" },
];

export function BuyTicketsCard() {
  const { refreshUser, loadingUser } = useTelegram();
  const openInvoice = useTelegramInvoice();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (loadingUser) return null;

  const handleBuy = async (tierId: string) => {
    setMessage(null);
    setLoadingTier(tierId);
    try {
      const res = await fetch("/api/stars/create-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData: (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })
            .Telegram?.WebApp?.initData,
          tier: tierId,
        }),
      });
      const data = await res.json();
      if (!data.invoiceUrl) {
        setMessage(data.error ?? "Could not start payment");
        setLoadingTier(null);
        return;
      }

      const status = await openInvoice(data.invoiceUrl);
      if (status === "paid") {
        setMessage("Payment successful! Tickets added.");
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
    <section className="card-glow rounded-2xl border border-gold/20 bg-card p-5 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-indigo-200/70">Buy Tickets</span>
        <span className="text-xs text-indigo-200/50">via Telegram Stars ⭐</span>
      </div>
      <div className="flex flex-col gap-2">
        {TIERS.map((t) => (
          <button
            key={t.id}
            onClick={() => handleBuy(t.id)}
            disabled={loadingTier !== null}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="text-indigo-100">
              {t.label} — {t.tickets} tickets
            </span>
            <span className="font-semibold text-gold">
              {loadingTier === t.id ? "..." : `${t.stars} ⭐`}
            </span>
          </button>
        ))}
      </div>
      {message && <p className="mt-2 text-center text-xs text-indigo-200/60">{message}</p>}
    </section>
  );
}