"use client";

import { useEffect, useState } from "react";
import { TrophyIcon, ChevronDownIcon } from "@/components/icons";
import { IconBadge } from "@/components/icon-badge";

type Winner = {
  id: string;
  display_name: string;
  prize_amount: number;
  week_label: string | null;
  created_at: string;
};

export function PreviousWinners() {
  const [winners, setWinners] = useState<Winner[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/raffle-info")
      .then((res) => res.json())
      .then((data) => setWinners(data.winners ?? []))
      .catch(() => setWinners([]));
  }, []);

  if (winners.length === 0) return null;

  return (
    <section className="card-soft rounded-2xl border border-border bg-card p-5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <IconBadge icon={<TrophyIcon />} tone="gold" size="sm" />
          <span className="text-sm font-medium text-text-dim">Previous Winners</span>
        </div>
        <ChevronDownIcon
          className={`h-4 w-4 text-text-faint transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-3 flex flex-col divide-y divide-border border-t border-border">
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
      )}
    </section>
  );
}
