import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentWeekEnd } from "@/lib/raffle-week";
import { RATE_LIMITS, rateLimitByIp, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const ipCheck = await rateLimitByIp(req, "raffleInfo", RATE_LIMITS.raffleInfo.ip);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const supabase = getSupabaseAdmin();

  const weekEndIso = getCurrentWeekEnd().toISOString();
  const nowIso = new Date().toISOString();

  // Two independent lookups (this week's raffle, and whether a winners batch
  // has gone live) run in parallel rather than in series.
  const [{ data: raffle }, { data: latest }] = await Promise.all([
    supabase.from("raffles").select("id").eq("week_end", weekEndIso).maybeSingle(),
    // Only the single most recent batch that has gone live is shown -- not an
    // accumulating history. A newly-scheduled batch replaces it entirely once
    // its own publish_at arrives, rather than piling on top of it.
    supabase
      .from("winner_announcements")
      .select("publish_at")
      .lte("publish_at", nowIso)
      .order("publish_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Each of these depends on the lookup above, but not on each other, so
  // they also run in parallel. Totals are computed as a SQL aggregate
  // (get_raffle_totals) rather than fetching every raffle_entries row for
  // the week and summing in JS -- same result, one row back instead of one
  // per participant.
  const [totalsResult, { data: winners }] = await Promise.all([
    raffle
      ? supabase.rpc("get_raffle_totals", { p_raffle_id: raffle.id })
      : Promise.resolve({ data: [{ total_tickets: 0, total_participants: 0 }] as const }),
    latest
      ? supabase
          .from("winner_announcements")
          .select("id, display_name, prize_amount, week_label, created_at")
          .eq("publish_at", latest.publish_at)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  const totals = totalsResult.data?.[0];

  return NextResponse.json(
    {
      totalTickets: Number(totals?.total_tickets ?? 0),
      totalParticipants: Number(totals?.total_participants ?? 0),
      winners: winners ?? [],
    },
    // Identical response for every caller -- Vercel's CDN can absorb repeat
    // requests within this window instead of hitting the function and DB
    // every time. Short enough that a fresh entry or a newly published
    // winners batch shows up well within one page view.
    { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" } }
  );
}