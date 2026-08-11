import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { WEEKLY_WINNER_COUNT, PRIZE_PER_WINNER_USDT } from "@/lib/raffle-week";

export type Entrant = { userId: string; tickets: number };

/**
 * Weighted random pick without replacement — each entrant can win at most
 * once, so more tickets improve your odds without letting you occupy
 * multiple winner slots in the same draw.
 *
 * Uses crypto.randomInt (Node's CSPRNG, rejection-sampled to avoid modulo
 * bias) instead of Math.random() -- this picks real money winners, so the
 * roll must not be predictable or reproducible the way a PRNG's output can
 * be. totalWeight is always a whole number of tickets, so an integer roll
 * uniform on [0, totalWeight) preserves exactly the same per-candidate
 * probability (tickets_i / totalWeight) that the old float roll gave.
 */
export function pickWinners(entrants: Entrant[], count: number): string[] {
  const pool = entrants.filter((e) => e.tickets > 0).map((e) => ({ ...e }));
  const winners: string[] = [];

  while (pool.length > 0 && winners.length < count) {
    const totalWeight = pool.reduce((sum, e) => sum + e.tickets, 0);
    let roll = crypto.randomInt(totalWeight);
    let pickedIndex = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      roll -= pool[i].tickets;
      if (roll < 0) {
        pickedIndex = i;
        break;
      }
    }
    winners.push(pool[pickedIndex].userId);
    pool.splice(pickedIndex, 1);
  }

  return winners;
}

export async function drawRaffleWinners(supabase: SupabaseClient, raffleId: string) {
  // Atomic compare-and-swap: only the caller that actually flips open->drawing
  // proceeds. Two overlapping invocations for the same raffle (a duplicate
  // cron fire, a retried request) would otherwise both pass a plain SELECT
  // check, independently roll winners, and insert two conflicting sets of
  // raffle_winners for the same raffle -- this makes that impossible.
  const { data: claimed } = await supabase
    .from("raffles")
    .update({ status: "drawing" })
    .eq("id", raffleId)
    .eq("status", "open")
    .select("id, week_end")
    .maybeSingle();

  if (!claimed) {
    return { drawn: false, reason: "Raffle is not open", winnerIds: [] as string[] };
  }
  const raffle = claimed;

  const { data: entries } = await supabase
    .from("raffle_entries")
    .select("user_id, tickets_used")
    .eq("raffle_id", raffleId);

  // Aggregate by user in case more than one entry row ever exists for the
  // same person — each entrant must appear in the pool exactly once.
  const ticketsByUser = new Map<string, number>();
  for (const e of entries ?? []) {
    if ((e.tickets_used ?? 0) <= 0) continue;
    const userId = e.user_id as string;
    ticketsByUser.set(userId, (ticketsByUser.get(userId) ?? 0) + (e.tickets_used as number));
  }
  const entrants: Entrant[] = Array.from(ticketsByUser, ([userId, tickets]) => ({ userId, tickets }));

  const winnerIds = pickWinners(entrants, WEEKLY_WINNER_COUNT);

  if (winnerIds.length > 0) {
    const weekLabel = `Wk of ${new Date(raffle.week_end).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })}`;

    await supabase.from("raffle_winners").insert(
      winnerIds.map((winnerId) => ({
        raffle_id: raffleId,
        user_id: winnerId,
        prize_amount: PRIZE_PER_WINNER_USDT,
        status: "pending",
        week_label: weekLabel,
      }))
    );
  }

  await supabase
    .from("raffles")
    .update({ status: "completed", drawn_at: new Date().toISOString() })
    .eq("id", raffleId);

  return { drawn: true, winnerIds };
}
