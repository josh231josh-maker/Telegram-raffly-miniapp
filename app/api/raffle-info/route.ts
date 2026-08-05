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

  const { data: winners } = await supabase
    .from("winner_announcements")
    .select("id, display_name, prize_amount, week_label, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({
    totalTickets,
    totalParticipants,
    winners: winners ?? [],
  });
}