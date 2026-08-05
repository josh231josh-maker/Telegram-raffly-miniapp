import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const supabase = getSupabaseAdmin();

  const { data: users } = await supabase.from("users").select("ticket_balance");

  const totalTickets = (users ?? []).reduce((sum, u) => sum + (u.ticket_balance ?? 0), 0);
  const totalParticipants = (users ?? []).filter((u) => (u.ticket_balance ?? 0) > 0).length;

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