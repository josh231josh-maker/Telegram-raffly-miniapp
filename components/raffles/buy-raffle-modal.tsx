"use client";

import { useState } from "react";
import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import { useTelegram } from "@/components/providers/telegram-provider";
import { useTelegramInvoice } from "@/hooks/useTelegramInvoice";
import { useTelegramBackButton } from "@/hooks/useTelegramBackButton";
import { fetchWithRetry } from "@/lib/fetch-retry";
import { CloseIcon } from "@/components/icons";
import { TicketImage } from "@/components/ticket-image";

// Display copy only -- the trusted price is set server-side in
// lib/stars-tiers.ts and enforced by the webhook regardless of what's shown
// here. Must stay in sync with that file so the price the user sees before
// paying matches what they're actually charged.
const TIERS = [
  { id: "raffle10", stars: 10, tickets: 12, icon: "/images/tier-1.png" },
  { id: "raffle50", stars: 50, tickets: 70, icon: "/images/tier-2.png" },
  { id: "raffle100", stars: 100, tickets: 150, icon: "/images/tier-3.png" },
  { id: "raffle250", stars: 250, tickets: 400, icon: "/images/tier-4.png" },
  { id: "raffle500", stars: 500, tickets: 850, icon: "/images/tier-5.png" },
  { id: "raffle1000", stars: 1000, tickets: 1800, icon: "/images/tier-6.png" },
];

type BuyRaffleModalProps = {
  onClose: () => void;
};

export function BuyRaffleModal({ onClose }: BuyRaffleModalProps) {
  const { user, refreshUser, getInitData } = useTelegram();
  const openInvoice = useTelegramInvoice();
  useTelegramBackButton(onClose);
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const balance = user?.ticket_balance ?? 0;

  const handleBuy = async (tierId: string) => {
    setSuccessMessage(null);
    setLoadingTier(tierId);
    try {
      // Safe to retry: this only mints a Stars invoice link, no DB write --
      // actual ticket crediting happens later, only once, via the webhook's
      // own dedup on the payment charge id.
      const res = await fetchWithRetry("/api/stars/create-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: getInitData(), tier: tierId }),
      });
      const data = await res.json();
      if (!data.invoiceUrl) {
        setLoadingTier(null);
        return;
      }

      const status = await openInvoice(data.invoiceUrl);
      if (status === "paid") {
        setSuccessMessage("Payment successful! Tickets added.");
        setTimeout(() => refreshUser(), 1500);
      }
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content
          className="fixed inset-x-0 bottom-0 z-50 w-full rounded-t-3xl bg-surface-dark p-5 focus:outline-none"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 22px)" }}
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm text-white/70">
              Balance
              <TicketImage size={16} />
              <span className="font-semibold text-white tabular-nums">{balance}</span>
            </div>
            <Dialog.Close asChild>
              <button
                className="flex size-8 items-center justify-center rounded-full bg-white/10 text-white/70"
                aria-label="Close"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex flex-col items-center py-3">
            <TicketImage size={56} />
            <Dialog.Title className="mt-3 font-heading text-xl font-bold text-white text-balance">
              Purchase Tickets
            </Dialog.Title>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {TIERS.map((t) => (
              <button
                key={t.id}
                onClick={() => handleBuy(t.id)}
                disabled={loadingTier !== null}
                className="flex w-full flex-col items-center gap-1 rounded-2xl bg-white/5 px-2 py-3.5 transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Image src={t.icon} alt="" width={44} height={44} />
                <span className="font-heading text-base font-bold text-white tabular-nums">
                  {t.tickets}
                </span>
                <span className="text-[10px] text-white/45">tickets</span>
                <span className="mt-1 flex items-center gap-1 rounded-full bg-accent/20 px-2 py-1 text-[11px] font-semibold text-accent-2 tabular-nums">
                  {loadingTier === t.id ? "..." : t.stars}
                  <Image src="/images/star-icon.png" alt="" width={12} height={12} />
                </span>
              </button>
            ))}
          </div>

          {successMessage && (
            <p className="mt-3 text-center text-xs text-white/60 text-pretty">{successMessage}</p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
