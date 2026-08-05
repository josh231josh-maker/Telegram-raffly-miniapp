"use client";

import { useEffect, useState } from "react";
import { useTelegram } from "@/components/providers/telegram-provider";

type RaffleInfo = {
  totalTickets: number;
  totalParticipants: number;
};

export function RaffleStats() {
  const { user } = useTelegram();
  const [info, setInfo] = useState<RaffleInfo | null>(null);

  useEffect(() => {
    fetch("/api/raffle-info")
      .then((res) => res.json())
      .then((data) => setInfo(data))
      .catch(() => setInfo(null));
  }, [user?.ticket_balance]);

  if (!info) return null;

  const yourTickets = user?.ticket_balance ?? 0;
  const chance =
    info.totalTickets > 0 ? ((yourTickets / info.totalTickets) * 100).toFixed(1) : "0.0";

  return (
    <section className="card-glow rounded-2xl border border-gold/20 bg-card p-5 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-indigo-200/70">This Week&apos;s Raffle</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-bold">{info.totalParticipants}</p>
          <p className="text-xs text-indigo-200/50">Participants</p>
        </div>
        <div>
          <p className="text-lg font-bold">{info.totalTickets}</p>
          <p className="text-xs text-indigo-200/50">Total Tickets</p>
        </div>
        <div>
          <p className="text-lg font-bold text-gold">{chance}%</p>
          <p className="text-xs text-indigo-200/50">Your Chance</p>
        </div>
      </div>
    </section>
  );
}