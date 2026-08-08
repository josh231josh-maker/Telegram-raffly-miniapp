"use client";

import { useEffect, useState } from "react";
import { useTelegram } from "@/components/providers/telegram-provider";
import { WEEKLY_WINNER_COUNT } from "@/lib/raffle-week";
import { TicketImage } from "@/components/ticket-image";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchWithRetry } from "@/lib/fetch-retry";

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
    let cancelled = false;
    fetchWithRetry("/api/raffle-info")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setInfo(data);
      })
      .catch(() => {
        // Retries in fetchWithRetry are already exhausted by this point --
        // leave `info` as-is (keeps showing the loading state) rather than
        // resetting to null, so a later successful retry from a re-render
        // isn't fighting a false "empty" state.
      });
    return () => {
      cancelled = true;
    };
  }, [raffleEntry?.ticketsEntered]);

  if (loadingUser || loadingRaffleEntry || !user) {
    return (
      <section className="card-soft rounded-[28px] border border-border bg-card p-5">
        <Skeleton className="mb-4 h-3.5 w-20 rounded-full" />
        <div className="flex items-center gap-5">
          <Skeleton className="h-24 w-24 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2.5">
            <Skeleton className="h-4 w-full rounded-full" />
            <Skeleton className="h-4 w-full rounded-full" />
            <Skeleton className="h-4 w-full rounded-full" />
          </div>
        </div>
        <div className="my-4 border-t border-border" />
        <Skeleton className="mb-3 h-4 w-40 rounded-full" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </section>
    );
  }

  const infoLoaded = info !== null;
  const yourTickets = raffleEntry?.ticketsEntered ?? 0;
  const totalTickets = info?.totalTickets ?? 0;
  const totalParticipants = info?.totalParticipants ?? 0;
  // With at most one winner per person, once participants <= the number of
  // weekly winners, every participant with a ticket is effectively certain
  // to win — the ticket-share estimate below only makes sense once there
  // are more participants than prizes to go around.
  const pct =
    yourTickets > 0 && totalParticipants > 0 && totalParticipants <= WEEKLY_WINNER_COUNT
      ? 100
      : totalTickets > 0
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
    <section className="card-soft rounded-[28px] border border-border bg-card p-5">
      <p className="mb-4 flex items-center gap-2 text-sm font-medium text-text-dim">
        <span className="float-bob">🎟</span>Your Odds
      </p>
      <div className="flex items-center gap-3">
        <div className="relative h-24 w-24 shrink-0 drop-shadow-[0_8px_16px_rgba(59,124,255,0.35)]">
          <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
            <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="var(--border)" strokeWidth="10" />
            <defs>
              <linearGradient id="oddsRingGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--pink)" />
                <stop offset="100%" stopColor="var(--purple)" />
              </linearGradient>
            </defs>
            <circle
              cx="50"
              cy="50"
              r={RADIUS}
              fill="none"
              stroke="url(#oddsRingGradient)"
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

        <div className="flex flex-1 flex-col gap-2 pl-1 text-xs">
          <div className="flex translate-x-2.5 items-center gap-2 rounded-2xl border border-border-soft bg-white/5 py-2 pl-2.5 pr-3">
            <span className="h-2 w-2 shrink-0 rounded-sm bg-pink" />
            <span className="text-text-dim">Your tickets</span>
            <span className="ml-auto font-heading font-bold tabular-nums text-text">{yourTickets}</span>
          </div>
          <div className="flex translate-x-5 items-center gap-2 rounded-2xl border border-border-soft bg-white/5 py-2 pl-2.5 pr-3">
            <span className="h-2 w-2 shrink-0 rounded-sm bg-purple" />
            <span className="text-text-dim">Total pool</span>
            <span className="ml-auto font-heading font-bold tabular-nums text-text">{totalTickets}</span>
          </div>
          <div className="flex translate-x-2.5 items-center gap-2 rounded-2xl border border-border-soft bg-white/5 py-2 pl-2.5 pr-3">
            <span className="h-2 w-2 shrink-0 rounded-sm bg-accent" />
            <span className="text-text-dim">Players</span>
            <span className="ml-auto font-heading font-bold tabular-nums text-text">{totalParticipants}</span>
          </div>
        </div>
      </div>

      <div className="my-4 border-t border-border" />

      <div className="mb-3 flex items-center gap-2">
        <TicketImage size={36} />
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
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-background p-3">
            <button
              onClick={() => setClamped(clampedAmount - 1)}
              disabled={status === "loading" || clampedAmount <= 0}
              className="btn-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Decrease amount"
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
              <span className="text-[11px] text-text-faint">of {available} tickets</span>
            </div>
            <button
              onClick={() => setClamped(clampedAmount + 1)}
              disabled={status === "loading" || clampedAmount >= available}
              className="btn-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Increase amount"
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
                {pct === 100 ? "Max" : `${pct}%`}
              </button>
            ))}
          </div>

          <button
            onClick={handleEnter}
            disabled={status === "loading" || clampedAmount <= 0}
            className="btn-accent w-full rounded-full px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {status === "loading" ? "Entering..." : `Enter ${clampedAmount || ""} ticket${clampedAmount === 1 ? "" : "s"}`}
          </button>
        </>
      )}

      {message && <p className="mt-2 text-center text-xs text-text-faint">{message}</p>}
    </section>
  );
}
