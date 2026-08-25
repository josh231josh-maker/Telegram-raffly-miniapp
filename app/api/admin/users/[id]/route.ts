import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { withReferralCount } from "@/lib/referral";
import { getCurrentWeekEnd } from "@/lib/raffle-week";
import { RATE_LIMITS, rateLimitByIp, rateLimitResponse } from "@/lib/rate-limit";

type ActivityEvent = {
  type: "raffle_entry" | "ad_view" | "transaction" | "withdrawal";
  created_at: string;
  detail: Record<string, unknown>;
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ipCheck = await rateLimitByIp(req, "adminRead", RATE_LIMITS.adminRead.ip);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: user, error } = await supabase.from("users").select("*").eq("id", id).single();
  if (error || !user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const [
    userWithReferralCount,
    { data: raffleEntries },
    { data: adViews },
    { data: transactions },
    { data: withdrawals },
    { data: currentRaffle },
  ] = await Promise.all([
    withReferralCount(supabase, user),
    supabase
      .from("raffle_entries")
      .select("id, tickets_used, created_at, raffle_id")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("ad_views")
      .select("id, viewed_at, converted")
      .eq("user_id", id)
      .order("viewed_at", { ascending: false })
      .limit(50),
    supabase
      .from("transactions")
      .select("id, type, currency, amount, tickets_granted, status, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("withdrawals")
      .select("id, amount, wallet_address, status, requested_at, processed_at")
      .eq("user_id", id)
      .order("requested_at", { ascending: false })
      .limit(50),
    // The current draw's raffle row doesn't exist until its first entry
    // (getOrCreateCurrentRaffle) -- no row here just means nobody, including
    // this user, has entered yet.
    supabase.from("raffles").select("id").eq("week_end", getCurrentWeekEnd().toISOString()).maybeSingle(),
  ]);

  // Summed from the same raffleEntries fetch above (already capped at this
  // user's most recent 50 entries, same as every other activity type here)
  // rather than a second query, since a raffle_id filter is all this needs.
  const entriesThisDraw = currentRaffle
    ? (raffleEntries ?? [])
        .filter((e) => e.raffle_id === currentRaffle.id)
        .reduce((sum, e) => sum + e.tickets_used, 0)
    : 0;

  const activity: ActivityEvent[] = [
    ...(raffleEntries ?? []).map((e) => ({
      type: "raffle_entry" as const,
      created_at: e.created_at,
      detail: { tickets_used: e.tickets_used, raffle_id: e.raffle_id },
    })),
    ...(adViews ?? []).map((a) => ({
      type: "ad_view" as const,
      created_at: a.viewed_at,
      detail: { converted: a.converted },
    })),
    ...(transactions ?? []).map((t) => ({
      type: "transaction" as const,
      created_at: t.created_at,
      detail: {
        type: t.type,
        currency: t.currency,
        amount: t.amount,
        tickets_granted: t.tickets_granted,
        status: t.status,
      },
    })),
    ...(withdrawals ?? []).map((w) => ({
      type: "withdrawal" as const,
      created_at: w.requested_at,
      detail: {
        amount: w.amount,
        wallet_address: w.wallet_address,
        status: w.status,
        processed_at: w.processed_at,
      },
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json({
    user: { ...userWithReferralCount, entries_this_draw: entriesThisDraw },
    activity,
  });
}
