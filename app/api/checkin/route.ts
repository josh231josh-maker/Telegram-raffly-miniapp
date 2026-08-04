import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramInitData } from "@/lib/telegram-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const REFERRAL_TICKET_THRESHOLD = 1;
const REFERRAL_REWARD_TICKETS = 50;

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
    return NextResponse.json({ alreadyCheckedIn: true, user: existing });
  }

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const newStreak =
    existing.last_checkin_date === yesterday ? existing.streak_count + 1 : 1;
  const ticketsEarned = Math.min(newStreak, 5);
  const newTicketBalance = existing.ticket_balance + ticketsEarned;

  const { data: updated, error: updateError } = await supabase
    .from("users")
    .update({
      ticket_balance: newTicketBalance,
      streak_count: newStreak,
      last_checkin_date: today,
    })
    .eq("id", existing.id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (
    existing.referred_by &&
    !existing.referral_reward_given &&
    newTicketBalance >= REFERRAL_TICKET_THRESHOLD
  ) {
    const { data: referrer } = await supabase
      .from("users")
      .select("id, ticket_balance")
      .eq("id", existing.referred_by)
      .single();

    if (referrer) {
      await supabase
        .from("users")
        .update({ ticket_balance: referrer.ticket_balance + REFERRAL_REWARD_TICKETS })
        .eq("id", referrer.id);

      await supabase
        .from("users")
        .update({ referral_reward_given: true })
        .eq("id", existing.id);
    }
  }

  return NextResponse.json({
    alreadyCheckedIn: false,
    ticketsEarned,
    streak: newStreak,
    user: updated,
  });
}