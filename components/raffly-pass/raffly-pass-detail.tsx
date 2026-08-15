"use client";

import { useState } from "react";
import Image from "next/image";
import { useTelegram } from "@/components/providers/telegram-provider";
import { useTelegramInvoice } from "@/hooks/useTelegramInvoice";
import { useTelegramBackButton } from "@/hooks/useTelegramBackButton";
import {
  RAFFLY_PASS_STARS,
  RAFFLY_PASS_DAILY_TICKETS,
  RAFFLY_PASS_DURATION_DAYS,
  isPassActive,
} from "@/lib/raffly-pass";
import { CheckIcon, CloseIcon } from "@/components/icons";

type RafflyPassDetailProps = {
  onClose: () => void;
};

const BENEFITS = [
  `${RAFFLY_PASS_DAILY_TICKETS} tickets every day for ${RAFFLY_PASS_DURATION_DAYS} days`,
  "2x tickets from watching ads",
  "Double daily check-in rewards",
];

export function RafflyPassDetail({ onClose }: RafflyPassDetailProps) {
  const { user, loadingUser, getInitData, refreshUser, claimPassTickets } = useTelegram();
  const openInvoice = useTelegramInvoice();
  useTelegramBackButton(onClose);
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const hasPass = !loadingUser && isPassActive(user?.raffly_pass_expires_at ?? null);
  const today = new Date().toISOString().slice(0, 10);
  const alreadyClaimedToday = user?.raffly_pass_last_claim_date === today;
  const daysLeft = hasPass
    ? Math.max(
        0,
        Math.ceil((new Date(user!.raffly_pass_expires_at!).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      )
    : 0;

  const handleBuy = async () => {
    setMessage(null);
    setStatus("loading");
    try {
      const res = await fetch("/api/stars/create-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: getInitData(), tier: "pass" }),
      });
      const data = await res.json();
      if (!data.invoiceUrl) {
        setMessage(data.error ?? "Could not start payment");
        setStatus("idle");
        return;
      }

      const invoiceStatus = await openInvoice(data.invoiceUrl);
      if (invoiceStatus === "paid") {
        setMessage("Raffly Pass activated!");
        setTimeout(() => refreshUser(), 1500);
      } else if (invoiceStatus === "cancelled") {
        setMessage("Payment cancelled");
      } else if (invoiceStatus !== "pending") {
        setMessage("Payment did not complete");
      }
    } catch {
      setMessage("Something went wrong");
    } finally {
      setStatus("idle");
    }
  };

  const handleClaim = async () => {
    setMessage(null);
    setStatus("loading");
    const result = await claimPassTickets();
    setStatus("idle");
    if (result.alreadyClaimed) {
      setMessage("Already claimed today's tickets");
    } else if (result.error) {
      setMessage(result.error);
    } else if (result.ticketsEarned) {
      setMessage(`+${result.ticketsEarned} tickets claimed!`);
    }
  };

  return (
    <div className="pass-gradient fixed inset-0 z-50 flex flex-col text-white">
      <div className="flex items-center justify-between px-5 pt-6">
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-8 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/25 text-white">
          <Image src="/images/crown-icon.png" alt="" width={48} height={35} />
        </span>
        <h1 className="font-heading mt-4 text-2xl font-bold text-balance">Raffly Pass</h1>

        {hasPass ? (
          <div className="mt-4 flex w-full items-center divide-x divide-white/20 rounded-2xl border border-white/20 bg-white/10 py-3">
            <div className="flex-1">
              <p className="font-heading text-2xl font-bold tabular-nums">{daysLeft}</p>
              <p className="text-[11px] text-white/60">Days left</p>
            </div>
            <div className="flex-1">
              <p className="font-heading text-2xl font-bold tabular-nums">{RAFFLY_PASS_DAILY_TICKETS}</p>
              <p className="text-[11px] text-white/60">Tickets/day</p>
            </div>
          </div>
        ) : (
          <>
            <p className="font-heading mt-1 flex items-center justify-center gap-1.5 text-3xl font-bold text-white">
              {RAFFLY_PASS_STARS}
              <Image src="/images/star-icon.png" alt="" width={28} height={27} />
            </p>
            <p className="text-xs text-white/50">one-time purchase</p>
          </>
        )}

        <div className="mt-6 w-full rounded-2xl bg-white/5 p-4 text-left">
          {BENEFITS.map((benefit) => (
            <div key={benefit} className="flex items-start gap-3 py-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/25 text-white">
                <CheckIcon className="h-3 w-3" />
              </span>
              <span className="text-sm text-white/80">{benefit}</span>
            </div>
          ))}
        </div>

        {hasPass ? (
          <button
            onClick={handleClaim}
            disabled={status === "loading" || alreadyClaimedToday}
            className="mt-6 w-full rounded-full bg-white px-4 py-3 text-sm font-semibold text-accent shadow-lg transition active:scale-[0.98] disabled:opacity-60"
          >
            {status === "loading"
              ? "Claiming..."
              : alreadyClaimedToday
              ? "Already claimed today"
              : `Claim today's ${RAFFLY_PASS_DAILY_TICKETS} tickets`}
          </button>
        ) : (
          <>
            <button
              onClick={handleBuy}
              disabled={status === "loading" || loadingUser}
              className="mt-6 w-full rounded-full bg-white px-4 py-3 text-sm font-semibold text-accent shadow-lg transition active:scale-[0.98] disabled:opacity-60"
            >
              {status === "loading" ? "Processing..." : "Get Raffly Pass"}
            </button>
            <p className="mt-3 text-[11px] text-white/40">Does not auto-renew.</p>
          </>
        )}

        {message && <p className="mt-3 text-xs text-white/60">{message}</p>}
      </div>
    </div>
  );
}
