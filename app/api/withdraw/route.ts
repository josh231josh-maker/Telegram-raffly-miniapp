import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramInitData } from "@/lib/telegram-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

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

  const amount = existing.usdt_balance;

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "No balance to withdraw" }, { status: 400 });
  }

  const { data: updatedUser, error: updateError } = await supabase
    .from("users")
    .update({ usdt_balance: 0 })
    .eq("id", existing.id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { error: withdrawError } = await supabase.from("withdrawals").insert({
    user_id: existing.id,
    amount,
    wallet_address: null,
    status: "pending",
  });

  if (withdrawError) {
    return NextResponse.json({ error: withdrawError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, amount, user: updatedUser });
}