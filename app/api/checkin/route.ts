import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramInitData } from "@/lib/telegram-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { checkAndRewardReferral, withReferralCount } from "@/lib/referral";
import { isPassActive } from "@/lib/raffly-pass";

export async function POST(req: NextRequest) {
  const { initData } = await req.json();
  if (!initData) {
    return NextResponse.json({ error: "Missing initData" }, { status: 400 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN!;
  const tgUser = verifyTelegramInitData(initData, botToken);
  if (!tgUser) {
    return NextResponse.json({ error: "Invalid initData" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const { data: existing, error: fetchError } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", tgUser.id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const today = new Date().toISOString().slice(0, 10);

  if (existing.last_checkin_date === today) {
    return NextResponse.json({
      alreadyCheckedIn: true,
      user: await withReferralCount(supabase, existing),
    });
  }

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const newStreak =
    existing.last_checkin_date === yesterday ? existing.streak_count + 1 : 1;
  const baseTicketsEarned = Math.min(newStreak, 5);
  const ticketsEarned = isPassActive(existing.raffly_pass_expires_at)
    ? baseTicketsEarned * 2
    : baseTicketsEarned;

  // Atomic: the DB-side guard on last_checkin_date means a duplicated
  // request (double-tap, retry) can never award the daily bonus twice.
  const { data: newBalance, error: rpcError } = await supabase.rpc("try_daily_checkin", {
    p_user_id: existing.id,
    p_today: today,
    p_new_streak: newStreak,
    p_tickets_earned: ticketsEarned,
  });

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  if (newBalance === null) {
    return NextResponse.json({
      alreadyCheckedIn: true,
      user: await withReferralCount(supabase, existing),
    });
  }

  await checkAndRewardReferral(supabase, existing.id);

  const { data: updated } = await supabase.from("users").select("*").eq("id", existing.id).single();

  return NextResponse.json({
    alreadyCheckedIn: false,
    ticketsEarned,
    streak: newStreak,
    user: await withReferralCount(supabase, updated),
  });
}