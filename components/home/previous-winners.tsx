"use client";

import { useState } from "react";
import { TrophyIcon, ChevronDownIcon } from "@/components/icons";
import { IconBadge } from "@/components/icon-badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { RaffleWinner } from "@/hooks/useRaffleInfo";
import { useLanguage } from "@/components/providers/language-provider";

type PreviousWinnersProps = {
  winners: RaffleWinner[] | null;
};

export function PreviousWinners({ winners }: PreviousWinnersProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  if (winners === null) {
    return (
      <section className="card-soft rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-28 rounded-full" />
            <Skeleton className="h-2.5 w-20 rounded-full" />
          </div>
        </div>
      </section>
    );
  }

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
          <div className="flex flex-col items-start">
            <span className="text-sm font-medium text-text-dim">{t("winners.title")}</span>
          </div>
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
