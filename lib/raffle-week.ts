import type { SupabaseClient } from "@supabase/supabase-js";

export const WEEKLY_WINNER_COUNT = 5;
export const PRIZE_POOL_USDT = 2500;
export const PRIZE_PER_WINNER_USDT = PRIZE_POOL_USDT / WEEKLY_WINNER_COUNT;

// Anchors which Mondays are draw days -- must stay a Monday at 00:00 UTC.
// Any Monday works as the anchor since only its parity (weeks-since-epoch
// mod 2) matters, not the specific date.
const BIWEEKLY_EPOCH_MS = Date.UTC(2024, 0, 1);
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Draw is 12am UTC every other Monday — keep in sync with the cron schedule in vercel.json */
export function getCurrentWeekEnd(now = new Date()): Date {
  const day = now.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysUntilMonday = day === 1 ? 7 : (1 - day + 7) % 7;

  const weekEnd = new Date(now);
  weekEnd.setUTCDate(now.getUTCDate() + daysUntilMonday);
  weekEnd.setUTCHours(0, 0, 0, 0);

  if (weekEnd <= now) {
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  }

  // Every other Monday is skipped so the draw lands every two weeks instead
  // of every one -- the cron below still fires weekly, but only raffles
  // whose week_end has actually arrived get drawn (see raffle/draw/route.ts),
  // so skipping a Monday here is enough to make the period two weeks long.
  const weeksSinceEpoch = Math.round((weekEnd.getTime() - BIWEEKLY_EPOCH_MS) / ONE_WEEK_MS);
  if (weeksSinceEpoch % 2 !== 0) {
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  }

  return weekEnd;
}

export function getCurrentRaffleWeek(now = new Date()) {
  const weekEnd = getCurrentWeekEnd(now);
  const weekStart = new Date(weekEnd);
  weekStart.setUTCDate(weekEnd.getUTCDate() - 14);
  return { weekStart, weekEnd };
}

export type Raffle = {
  id: string;
  week_start: string;
  week_end: string;
  status: string;
  drawn_at: string | null;
  created_at: string;
};

/** Fetches the open raffle for the current week, creating it on first entry. */
export async function getOrCreateCurrentRaffle(
  supabase: SupabaseClient
): Promise<Raffle> {
  const { weekStart, weekEnd } = getCurrentRaffleWeek();
  const weekEndIso = weekEnd.toISOString();

  const { data: existing } = await supabase
    .from("raffles")
    .select("*")
    .eq("week_end", weekEndIso)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("raffles")
    .insert({
      week_start: weekStart.toISOString(),
      week_end: weekEndIso,
      status: "open",
    })
    .select()
    .single();

  if (error) {
    const { data: raceExisting } = await supabase
      .from("raffles")
      .select("*")
      .eq("week_end", weekEndIso)
      .maybeSingle();
    if (raceExisting) return raceExisting;
    throw error;
  }

  return created;
}