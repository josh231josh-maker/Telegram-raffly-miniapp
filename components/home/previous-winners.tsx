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
    <section className="card-soft rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-text-dim">Previous Winners</span>
        <span className="text-lg" aria-hidden="true">
          🏆
        </span>
      </div>
      <div className="flex flex-col divide-y divide-border">
        {winners.map((w) => (
          <div key={w.id} className="flex items-center justify-between py-2 text-sm">
            <span className="text-text">
              {w.display_name}
              {w.week_label ? (
                <span className="ml-2 text-xs text-text-faint">{w.week_label}</span>
              ) : null}
            </span>
            <span className="font-semibold text-green">${Number(w.prize_amount).toFixed(0)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
