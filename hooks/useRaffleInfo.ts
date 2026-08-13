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
    // the moment a stale cached total pool reads as "didn't update".
    //
    // `cache: "no-store"` alone doesn't fix that: it only tells the browser
    // not to serve this request from its own local disk cache. The actual
    // staleness comes from Vercel's shared edge/CDN cache, which caches by
    // URL per the response's own Cache-Control header regardless of what
    // cache mode the request was made with. A same-URL refetch can still hit
    // that shared cache and get back the pre-entry total. Appending a
    // cache-busting query param gives the refetch a distinct URL, so it's a
    // guaranteed miss there too -- while everyone else's plain, unbusted
    // requests still share the 10s cache as intended.
    const isRefetch = !isFirstFetchRef.current;
    isFirstFetchRef.current = false;

    const url = isRefetch ? `/api/raffle-info?t=${Date.now()}` : "/api/raffle-info";
    fetchWithRetry(url, isRefetch ? { cache: "no-store" } : undefined)
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
