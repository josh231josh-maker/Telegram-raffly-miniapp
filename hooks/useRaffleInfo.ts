"use client";

import { useEffect, useState } from "react";
import { fetchWithRetry } from "@/lib/fetch-retry";

export type RaffleWinner = {
  id: string;
  display_name: string;
  prize_amount: number;
  week_label: string | null;
  created_at: string;
};

export type RaffleInfo = {
  totalTickets: number;
  totalParticipants: number;
  winners: RaffleWinner[];
};

/**
 * Single shared fetch of /api/raffle-info for the Home tab -- OddsRingCard
 * and PreviousWinners both need data from this same endpoint, and used to
 * each fetch it independently. Called once here instead, with the result
 * passed down as props, so a Home-tab view costs one request/query, not two.
 */
export function useRaffleInfo(refetchKey?: unknown): RaffleInfo | null {
  const [info, setInfo] = useState<RaffleInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchWithRetry("/api/raffle-info")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setInfo(data);
      })
      .catch(() => {
        // Retries already exhausted -- stay in the loading state rather than
        // resolving to an empty result, so this doesn't get mistaken for
        // "genuinely no data" by either consumer.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetchKey]);

  return info;
}
