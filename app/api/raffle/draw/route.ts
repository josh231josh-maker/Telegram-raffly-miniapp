import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { drawRaffleWinners } from "@/lib/raffle-draw";
import { logger } from "@/lib/logger";
import { timingSafeEqual } from "@/lib/timing-safe";

// Triggered weekly by Vercel Cron (see vercel.json), but only raffles whose
// week_end has actually arrived get drawn -- since raffle-week.ts now spaces
// week_end two weeks apart, this fires every Monday but only draws every
// other one. Vercel automatically sends `Authorization: Bearer $CRON_SECRET`
// on cron-triggered requests.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : undefined;
  if (!timingSafeEqual(authHeader, expected)) {
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
    try {
      const result = await drawRaffleWinners(supabase, raffle.id);
      logger.info("raffle_draw.completed", { raffleId: raffle.id, ...result });
      results.push({ raffleId: raffle.id, ...result });
    } catch (err) {
      logger.error("raffle_draw.failed", { raffleId: raffle.id, error: err instanceof Error ? err.message : String(err) });
      results.push({ raffleId: raffle.id, drawn: false, reason: "Draw failed", winnerIds: [] as string[] });
    }
  }

  return NextResponse.json({ results });
}
