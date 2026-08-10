import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
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
    { count: referralCount },
    { count: referralReachedCount },
    { data: raffleEntries },
    { data: adViews },
    { data: transactions },
    { data: withdrawals },
  ] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }).eq("referred_by", id),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("referred_by", id)
      .eq("referral_reward_given", true),
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
  ]);

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
    user: {
      ...user,
      referral_count: referralCount ?? 0,
      referral_reached_count: referralReachedCount ?? 0,
    },
    activity,
  });
}
