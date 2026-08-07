import type { SupabaseClient } from "@supabase/supabase-js";

export const WEEKLY_WINNER_COUNT = 5;

/** Weekly draw is 12am UTC Monday — keep in sync with the cron schedule in vercel.json */
export function getCurrentWeekEnd(now = new Date()): Date {
  const day = now.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysUntilMonday = day === 1 ? 7 : (1 - day + 7) % 7;

  const weekEnd = new Date(now);
  weekEnd.setUTCDate(now.getUTCDate() + daysUntilMonday);
  weekEnd.setUTCHours(0, 0, 0, 0);

  if (weekEnd <= now) {
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  }

  return weekEnd;
}

export function getCurrentRaffleWeek(now = new Date()) {
  const weekEnd = getCurrentWeekEnd(now);
  const weekStart = new Date(weekEnd);
  weekStart.setUTCDate(weekEnd.getUTCDate() - 7);
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