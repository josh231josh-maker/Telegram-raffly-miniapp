import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentWeekEnd } from "@/lib/raffle-week";

export async function GET() {
  const supabase = getSupabaseAdmin();

  const weekEndIso = getCurrentWeekEnd().toISOString();

  const { data: raffle } = await supabase
    .from("raffles")
    .select("id")
    .eq("week_end", weekEndIso)
    .maybeSingle();

  const { data: entries } = raffle
    ? await supabase
        .from("raffle_entries")
        .select("tickets_used")
        .eq("raffle_id", raffle.id)
    : { data: [] };

  const totalTickets = (entries ?? []).reduce((sum, e) => sum + (e.tickets_used ?? 0), 0);
  const totalParticipants = (entries ?? []).filter((e) => (e.tickets_used ?? 0) > 0).length;

  // Only the single most recent batch that has gone live is shown -- not an
  // accumulating history. A newly-scheduled batch replaces it entirely once
  // its own publish_at arrives, rather than piling on top of it.
  const nowIso = new Date().toISOString();
  const { data: latest } = await supabase
    .from("winner_announcements")
    .select("publish_at")
    .lte("publish_at", nowIso)
    .order("publish_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: winners } = latest
    ? await supabase
        .from("winner_announcements")
        .select("id, display_name, prize_amount, week_label, created_at")
        .eq("publish_at", latest.publish_at)
        .order("created_at", { ascending: true })
    : { data: [] };

  return NextResponse.json({
    totalTickets,
    totalParticipants,
    winners: winners ?? [],
  });
}