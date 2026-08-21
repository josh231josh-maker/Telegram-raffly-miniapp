import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrCreateCurrentRaffle } from "@/lib/raffle-week";
import { logger } from "@/lib/logger";

export type AutoEntryRunResult = {
  raffleOpen: boolean;
  processed: number;
  entered: number;
  skippedInsufficientBalance: number;
  failed: number;
};

/**
 * Reuses the same enter_raffle RPC the manual /api/raffle-entry flow calls --
 * this is just a scheduled caller of it, not a separate entry mechanism, so
 * every atomicity/status guarantee enter_raffle already has applies here too.
 *
 * A rule's last_entered_at is only advanced on a *successful* entry. Skipped
 * cycles (insufficient balance, a transient RPC error) leave it untouched so
 * the very next run retries the same due cycle instead of waiting out a
 * whole extra interval -- matches "resume automatically" rather than "lose
 * a turn".
 *
 * Concurrent overlapping runs (e.g. a duplicate scheduler delivery) could in
 * theory both see the same rule as due and both enter it before either write
 * lands -- accepted here since the blast radius is "this one account's own
 * tickets go in slightly early/twice", not a cross-user integrity issue, and
 * the endpoint driving this is secret-gated so only the configured scheduler
 * can trigger it at all.
 */
export async function processDueAutoEntries(supabase: SupabaseClient): Promise<AutoEntryRunResult> {
  const raffle = await getOrCreateCurrentRaffle(supabase);
  if (raffle.status !== "open") {
    return { raffleOpen: false, processed: 0, entered: 0, skippedInsufficientBalance: 0, failed: 0 };
  }

  const { data: rules, error } = await supabase
    .from("auto_entry_rules")
    .select("id, user_id, tickets_per_entry, interval_minutes, last_entered_at, users(ticket_balance)")
    .eq("enabled", true);

  if (error) {
    logger.error("auto_entry.list_failed", { error: error.message });
    return { raffleOpen: true, processed: 0, entered: 0, skippedInsufficientBalance: 0, failed: 0 };
  }

  const now = Date.now();
  let processed = 0;
  let entered = 0;
  let skippedInsufficientBalance = 0;
  let failed = 0;

  for (const rule of rules ?? []) {
    const dueAt = rule.last_entered_at
      ? new Date(rule.last_entered_at).getTime() + rule.interval_minutes * 60_000
      : 0;
    if (now < dueAt) continue;

    processed++;
    const balance = (rule.users as unknown as { ticket_balance: number } | null)?.ticket_balance ?? 0;
    if (balance < rule.tickets_per_entry) {
      skippedInsufficientBalance++;
      continue;
    }

    const { data: newTicketsUsed, error: rpcError } = await supabase.rpc("enter_raffle", {
      p_user_id: rule.user_id,
      p_raffle_id: raffle.id,
      p_tickets: rule.tickets_per_entry,
    });

    if (rpcError || newTicketsUsed === null) {
      failed++;
      logger.warn("auto_entry.entry_failed", {
        ruleId: rule.id,
        userId: rule.user_id,
        error: rpcError?.message,
      });
      continue;
    }

    entered++;
    await supabase
      .from("auto_entry_rules")
      .update({ last_entered_at: new Date().toISOString() })
      .eq("id", rule.id);
    logger.info("auto_entry.entered", {
      ruleId: rule.id,
      userId: rule.user_id,
      tickets: rule.tickets_per_entry,
    });
  }

  return { raffleOpen: true, processed, entered, skippedInsufficientBalance, failed };
}
