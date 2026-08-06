import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramInitData } from "@/lib/telegram-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { RAFFLY_PASS_DAILY_TICKETS, isPassActive } from "@/lib/raffly-pass";

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

  if (!isPassActive(existing.raffly_pass_expires_at)) {
    return NextResponse.json({ error: "No active Raffly Pass" }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  if (existing.raffly_pass_last_claim_date === today) {
    return NextResponse.json({ alreadyClaimed: true, user: existing });
  }

  const { data: updated, error: updateError } = await supabase
    .from("users")
    .update({
      ticket_balance: existing.ticket_balance + RAFFLY_PASS_DAILY_TICKETS,
      raffly_pass_last_claim_date: today,
    })
    .eq("id", existing.id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    alreadyClaimed: false,
    ticketsEarned: RAFFLY_PASS_DAILY_TICKETS,
    user: updated,
  });
}
