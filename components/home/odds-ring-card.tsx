"use client";

import { useEffect, useState } from "react";
import { useTelegram } from "@/components/providers/telegram-provider";
import { WEEKLY_WINNER_COUNT } from "@/lib/raffle-week";

type RaffleInfo = {
  totalTickets: number;
  totalParticipants: number;
};

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function OddsRingCard() {
  const { raffleEntry } = useTelegram();
  const [info, setInfo] = useState<RaffleInfo | null>(null);

  useEffect(() => {
    fetch("/api/raffle-info")
      .then((res) => res.json())
      .then((data) => setInfo(data))
      .catch(() => setInfo(null));
  }, [raffleEntry?.ticketsEntered]);

  const yourTickets = raffleEntry?.ticketsEntered ?? 0;
  const totalTickets = info?.totalTickets ?? 0;
  const totalParticipants = info?.totalParticipants ?? 0;
  const pct =
    totalTickets > 0
      ? Math.min(100, (yourTickets / totalTickets) * WEEKLY_WINNER_COUNT * 100)
      : 0;
  const chance = pct.toFixed(2);
  const dashOffset = CIRCUMFERENCE * (1 - pct / 100);

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
    </section>
  );
}
