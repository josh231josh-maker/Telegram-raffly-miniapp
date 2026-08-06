"use client";

import { useState } from "react";
import { useTelegram } from "@/components/providers/telegram-provider";
import { useTelegramInvoice } from "@/hooks/useTelegramInvoice";
import { TicketIcon, StarIcon } from "@/components/icons";
import { IconBadge } from "@/components/icon-badge";

// TODO: raise back to real prices (10/50/100) before launch
// Diagnostic: entry temporarily at 3 stars (not 1), must match app/api/stars/create-invoice/route.ts
const TIERS = [
  { id: "entry", stars: 3, tickets: 15, label: "Entry Pack" },
  { id: "better", stars: 1, tickets: 90, label: "Better Value" },
  { id: "best", stars: 1, tickets: 200, label: "Best Value" },
];

export function BuyTicketsCard() {
  const { refreshUser, loadingUser, getInitData } = useTelegram();
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
          initData: getInitData(),
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
    <section className="card-soft rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <IconBadge icon={<TicketIcon />} tone="gold" size="sm" />
          <span className="text-sm font-medium text-text-dim">Buy Tickets</span>
        </div>
        <span className="text-xs text-text-faint">via Telegram Stars</span>
      </div>
      <div className="flex flex-col gap-2">
        {TIERS.map((t) => (
          <button
            key={t.id}
            onClick={() => handleBuy(t.id)}
            disabled={loadingTier !== null}
            className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="text-text">
              {t.label} — {t.tickets} tickets
            </span>
            <span className="flex items-center gap-1 font-semibold text-gold">
              {loadingTier === t.id ? "..." : t.stars}
              <StarIcon className="h-3.5 w-3.5" />
            </span>
          </button>
        ))}
      </div>
      {message && <p className="mt-2 text-center text-xs text-text-faint">{message}</p>}
    </section>
  );
}
