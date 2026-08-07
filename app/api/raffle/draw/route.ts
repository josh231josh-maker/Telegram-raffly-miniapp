import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { drawRaffleWinners } from "@/lib/raffle-draw";

// Triggered weekly by Vercel Cron (see vercel.json). Vercel automatically
// sends `Authorization: Bearer $CRON_SECRET` on cron-triggered requests.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const { data: dueRaffles } = await supabase
    .from("raffles")
    .select("id")
    .eq("status", "open")
    .lte("week_end", new Date().toISOString());

  const results = [];
  for (const raffle of dueRaffles ?? []) {
    results.push({ raffleId: raffle.id, ...(await drawRaffleWinners(supabase, raffle.id)) });
  }

  return NextResponse.json({ results });
}
