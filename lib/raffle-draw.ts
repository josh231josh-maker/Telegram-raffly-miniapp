import type { SupabaseClient } from "@supabase/supabase-js";
import { WEEKLY_WINNER_COUNT, PRIZE_PER_WINNER_USDT } from "@/lib/raffle-week";

type Entrant = { userId: string; tickets: number };

/**
 * Weighted random pick without replacement — each entrant can win at most
 * once, so more tickets improve your odds without letting you occupy
 * multiple winner slots in the same draw.
 */
function pickWinners(entrants: Entrant[], count: number): string[] {
  const pool = entrants.filter((e) => e.tickets > 0).map((e) => ({ ...e }));
  const winners: string[] = [];

  while (pool.length > 0 && winners.length < count) {
    const totalWeight = pool.reduce((sum, e) => sum + e.tickets, 0);
    let roll = Math.random() * totalWeight;
    let pickedIndex = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      roll -= pool[i].tickets;
      if (roll <= 0) {
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
  const { data: raffle } = await supabase
    .from("raffles")
    .select("id, status, week_end")
    .eq("id", raffleId)
    .single();

  if (!raffle || raffle.status !== "open") {
    return { drawn: false, reason: "Raffle is not open", winnerIds: [] as string[] };
  }

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

    for (const winnerId of winnerIds) {
      await supabase.from("raffle_winners").insert({
        raffle_id: raffleId,
        user_id: winnerId,
        prize_amount: PRIZE_PER_WINNER_USDT,
        status: "pending",
        week_label: weekLabel,
      });
    }
  }

  await supabase
    .from("raffles")
    .update({ status: "completed", drawn_at: new Date().toISOString() })
    .eq("id", raffleId);

  return { drawn: true, winnerIds };
}
