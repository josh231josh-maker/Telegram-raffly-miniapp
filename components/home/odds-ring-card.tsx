"use client";

import { useState } from "react";
import { useTelegram } from "@/components/providers/telegram-provider";
import { WEEKLY_WINNER_COUNT } from "@/lib/raffle-week";
import { winProbabilityPct } from "@/lib/raffle-odds";
import { TicketImage } from "@/components/ticket-image";
import { Skeleton } from "@/components/ui/skeleton";
import type { RaffleInfo } from "@/hooks/useRaffleInfo";
import { useLanguage } from "@/components/providers/language-provider";

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type OddsRingCardProps = {
  onGetMore?: () => void;
  info: RaffleInfo | null;
};

export function OddsRingCard({ onGetMore, info }: OddsRingCardProps) {
  const { user, raffleEntry, loadingUser, loadingRaffleEntry, enterRaffle } = useTelegram();
  const { t } = useLanguage();
  const [amount, setAmount] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [message, setMessage] = useState<string | null>(null);

  if (loadingUser || loadingRaffleEntry || !user) {
    return (
      <section className="card-soft rounded-[28px] border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Skeleton className="h-3.5 w-20 rounded-full" />
          <Skeleton className="h-3.5 w-28 rounded-full" />
        </div>
        <div className="flex items-center gap-5">
          <Skeleton className="h-24 w-24 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2.5">
            <Skeleton className="h-4 w-full rounded-full" />
            <Skeleton className="h-4 w-full rounded-full" />
          </div>
        </div>
        <div className="my-3 border-t border-border" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </section>
    );
  }

  const infoLoaded = info !== null;
  const yourTickets = raffleEntry?.ticketsEntered ?? 0;
  const totalTickets = info?.totalTickets ?? 0;
  const pct = winProbabilityPct(yourTickets, totalTickets, WEEKLY_WINNER_COUNT);
  const chance = pct.toFixed(2);
  const dashOffset = CIRCUMFERENCE * (1 - pct / 100);

  const available = user.ticket_balance;
  const raffleClosed = raffleEntry?.status != null && raffleEntry.status !== "open";
  const clampedAmount = Math.min(Math.max(amount, 0), available);

  const setClamped = (value: number) => {
    setAmount(Math.min(Math.max(Math.round(value), 0), available));
  };

  const handleEnter = async () => {
    if (clampedAmount <= 0) return;
    setMessage(null);
    setStatus("loading");
    const result = await enterRaffle(clampedAmount);
    setStatus("idle");
    if (result.success) {
      setMessage(
        t(clampedAmount === 1 ? "odds.enteredOne" : "odds.enteredMany", { n: clampedAmount })
      );
      setAmount(0);
    } else {
      setMessage(result.error ?? t("common.somethingWrong"));
    }
  };

  return (
    <section className="card-soft rounded-[28px] border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-text-dim">{t("odds.title")}</p>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-text-dim">{t("odds.thisDraw")}</span>
          <TicketImage size={20} />
        </div>
      </div>
      <div className="flex items-center gap-5">
        <div className="relative h-24 w-24 shrink-0">
          <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
            <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="var(--border)" strokeWidth="10" />
            <circle
              cx="50"
              cy="50"
              r={RADIUS}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              style={{ transition: "stroke-dashoffset 0.4s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {infoLoaded ? (
              <span className="font-heading text-lg font-bold text-text">{chance}%</span>
            ) : (
              <Skeleton className="h-4 w-10 rounded-full" />
            )}
          </div>
        </div>

        <div className="flex-1 text-sm">
          <div className="flex items-center justify-between border-b border-border py-1.5">
            <span className="text-text-dim">{t("odds.yourTickets")}</span>
            <span className="font-semibold text-text">{yourTickets}</span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-text-dim">{t("odds.totalPool")}</span>
            <span className="font-semibold text-text">{totalTickets}</span>
          </div>
        </div>
      </div>

      <div className="my-3 border-t border-border" />

      {raffleClosed ? (
        <p className="text-center text-xs text-text-faint">{t("odds.entriesClosed")}</p>
      ) : available <= 0 ? (
        <div className="flex flex-col items-center gap-3 py-1">
          <p className="text-center text-xs text-text-faint">{t("odds.noTickets")}</p>
          <button
            onClick={onGetMore}
            className="btn-accent flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition"
          >
            {t("odds.getMore")}
            <TicketImage size={14} />
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-background p-3">
            <button
              onClick={() => setClamped(clampedAmount - 1)}
              disabled={status === "loading" || clampedAmount <= 0}
              className="btn-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={t("odds.decreaseAmount")}
            >
              −
            </button>
            <div className="flex flex-1 flex-col items-center">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={available}
                value={clampedAmount}
                onChange={(e) => setClamped(Number(e.target.value))}
                disabled={status === "loading"}
                className="w-20 bg-transparent text-center font-heading text-3xl font-bold text-text outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="text-[11px] text-text-faint">{t("odds.ofTickets", { n: available })}</span>
            </div>
            <button
              onClick={() => setClamped(clampedAmount + 1)}
              disabled={status === "loading" || clampedAmount >= available}
              className="btn-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={t("odds.increaseAmount")}
            >
              +
            </button>
          </div>

          <div className="my-3 grid grid-cols-3 gap-2">
            {[25, 50, 100].map((pct) => (
              <button
                key={pct}
                onClick={() => setClamped(Math.round((available * pct) / 100))}
                disabled={status === "loading"}
                className="rounded-full border border-border py-2 text-xs font-semibold text-text-dim transition disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pct === 100 ? t("odds.max") : `${pct}%`}
              </button>
            ))}
          </div>

          <button
            onClick={handleEnter}
            disabled={status === "loading" || clampedAmount <= 0}
            className="btn-accent w-full rounded-full px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {status === "loading"
              ? t("odds.entering")
              : t(clampedAmount === 1 ? "odds.enterTicketsOne" : "odds.enterTicketsMany", {
                  n: clampedAmount,
                })}
          </button>
        </>
      )}

      {message && <p className="mt-2 text-center text-xs text-text-faint">{message}</p>}
    </section>
  );
}
