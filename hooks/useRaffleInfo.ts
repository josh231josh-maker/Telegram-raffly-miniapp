"use client";

import { useEffect, useRef, useState } from "react";
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
  const isFirstFetchRef = useRef(true);

  useEffect(() => {
    let cancelled = false;

    // The route's Cache-Control (public, s-maxage=10) is there so many
    // different users opening the Home tab in the same few seconds share one
    // cached response instead of each hitting the DB -- worth keeping for
    // the common case. But every refetch *after* the first one here only
    // ever happens because refetchKey (ticketsEntered) just changed, which
    // only happens right after this same user's own raffle entry -- exactly
    // the moment a stale cached total pool reads as "didn't update". Only
    // those refetches bypass the cache; the shared cache still helps
    // everyone else's initial loads.
    const isRefetch = !isFirstFetchRef.current;
    isFirstFetchRef.current = false;

    fetchWithRetry("/api/raffle-info", isRefetch ? { cache: "no-store" } : undefined)
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
