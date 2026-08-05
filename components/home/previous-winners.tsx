"use client";

import { useEffect, useState } from "react";

type Winner = {
  id: string;
  display_name: string;
  prize_amount: number;
  week_label: string | null;
  created_at: string;
};

export function PreviousWinners() {
  const [winners, setWinners] = useState<Winner[]>([]);

  useEffect(() => {
    fetch("/api/raffle-info")
      .then((res) => res.json())
      .then((data) => setWinners(data.winners ?? []))
      .catch(() => setWinners([]));
  }, []);

  if (winners.length === 0) return null;

  return (
    <section className="card-glow rounded-2xl border border-gold/20 bg-card p-5 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-indigo-200/70">Previous Winners</span>
        <span className="text-lg">🏆</span>
      </div>
      <div className="flex flex-col gap-2">
        {winners.map((w) => (
          <div key={w.id} className="flex items-center justify-between text-sm">
            <span className="text-indigo-100">
              {w.display_name}
              {w.week_label ? (
                <span className="ml-2 text-xs text-indigo-200/40">{w.week_label}</span>
              ) : null}
            </span>
            <span className="font-semibold text-gold">${Number(w.prize_amount).toFixed(0)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}