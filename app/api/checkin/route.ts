import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramInitData } from "@/lib/telegram-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { checkAndRewardReferral } from "@/lib/referral";

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

  await checkAndRewardReferral(supabase, existing.id);

  return NextResponse.json({
    alreadyCheckedIn: false,
    ticketsEarned,
    streak: newStreak,
    user: updated,
  });
}