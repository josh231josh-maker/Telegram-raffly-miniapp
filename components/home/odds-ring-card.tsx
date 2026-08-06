"use client";

import { useEffect, useState } from "react";
import { useTelegram } from "@/components/providers/telegram-provider";
import { WEEKLY_WINNER_COUNT } from "@/lib/raffle-week";
import { TicketIcon } from "@/components/icons";
import { IconBadge } from "@/components/icon-badge";

type RaffleInfo = {
  totalTickets: number;
  totalParticipants: number;
};

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function OddsRingCard() {
  const { user, raffleEntry, loadingUser, loadingRaffleEntry, enterRaffle } = useTelegram();
  const [info, setInfo] = useState<RaffleInfo | null>(null);
  const [amount, setAmount] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/raffle-info")
      .then((res) => res.json())
      .then((data) => setInfo(data))
      .catch(() => setInfo(null));
  }, [raffleEntry?.ticketsEntered]);

  if (loadingUser || loadingRaffleEntry || !user) return null;

  const yourTickets = raffleEntry?.ticketsEntered ?? 0;
  const totalTickets = info?.totalTickets ?? 0;
  const totalParticipants = info?.totalParticipants ?? 0;
  const pct =
    totalTickets > 0
      ? Math.min(100, (yourTickets / totalTickets) * WEEKLY_WINNER_COUNT * 100)
      : 0;
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
      setMessage(`Entered ${clampedAmount} ticket${clampedAmount === 1 ? "" : "s"} into this week's draw!`);
      setAmount(0);
    } else {
      setMessage(result.error ?? "Something went wrong");
    }
  };

  return (
    <section className="card-soft rounded-2xl border border-border bg-card p-5">
      <p className="mb-4 text-sm font-medium text-text-dim">Your Odds</p>
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
            <span className="font-heading text-lg font-bold text-text">{chance}%</span>
          </div>
        </div>

        <div className="flex-1 text-sm">
          <div className="flex items-center justify-between border-b border-border py-1.5">
            <span className="text-text-dim">Your tickets</span>
            <span className="font-semibold text-text">{yourTickets}</span>
          </div>
          <div className="flex items-center justify-between border-b border-border py-1.5">
            <span className="text-text-dim">Total pool</span>
            <span className="font-semibold text-text">{totalTickets}</span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-text-dim">Participants</span>
            <span className="font-semibold text-text">{totalParticipants}</span>
          </div>
        </div>
      </div>

      <div className="my-4 border-t border-border" />

      <div className="mb-3 flex items-center gap-2">
        <IconBadge icon={<TicketIcon />} tone="gold" size="sm" />
        <span className="text-sm font-medium text-text-dim">Enter This Week&apos;s Draw</span>
      </div>

      {raffleClosed ? (
        <p className="text-center text-xs text-text-faint">
          Entries are closed while this week&apos;s draw is in progress.
        </p>
      ) : available <= 0 ? (
        <p className="text-center text-xs text-text-faint">
          You have no tickets to enter. Earn tickets from check-ins, ads, or referrals.
        </p>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-center gap-3">
            <button
              onClick={() => setClamped(clampedAmount - 1)}
              disabled={status === "loading" || clampedAmount <= 0}
              className="h-9 w-9 rounded-full border border-border bg-accent-soft text-lg text-accent transition disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Decrease amount"
            >
              −
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={available}
              value={clampedAmount}
              onChange={(e) => setClamped(Number(e.target.value))}
              disabled={status === "loading"}
              className="w-20 rounded-lg border border-border bg-background py-2 text-center text-lg font-semibold text-text"
            />
            <button
              onClick={() => setClamped(clampedAmount + 1)}
              disabled={status === "loading" || clampedAmount >= available}
              className="h-9 w-9 rounded-full border border-border bg-accent-soft text-lg text-accent transition disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Increase amount"
            >
              +
            </button>
            <button
              onClick={() => setClamped(available)}
              disabled={status === "loading" || clampedAmount >= available}
              className="rounded-lg border border-accent/30 px-3 py-2 text-xs font-semibold text-accent transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              Max
            </button>
          </div>

          <p className="mb-3 text-center text-xs text-text-faint">
            {available} ticket{available === 1 ? "" : "s"} available
          </p>

          <button
            onClick={handleEnter}
            disabled={status === "loading" || clampedAmount <= 0}
            className="btn-accent w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {status === "loading" ? "Entering..." : `Enter ${clampedAmount || ""} ticket${clampedAmount === 1 ? "" : "s"}`}
          </button>
        </>
      )}

      {message && <p className="mt-2 text-center text-xs text-text-faint">{message}</p>}
    </section>
  );
}
