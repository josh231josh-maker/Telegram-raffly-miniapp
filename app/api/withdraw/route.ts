import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramInitData } from "@/lib/telegram-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { withReferralCount } from "@/lib/referral";

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

  const { data: user, error: fetchError } = await supabase
    .from("users")
    .select("id, usdt_balance, ton_wallet_address")
    .eq("telegram_id", tgUser.id)
    .single();

  if (fetchError || !user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (!user.usdt_balance || user.usdt_balance <= 0) {
    return NextResponse.json({ error: "No balance available for withdrawal" }, { status: 400 });
  }

  if (!user.ton_wallet_address) {
    return NextResponse.json({ error: "No wallet connected" }, { status: 400 });
  }

  // Balance isn't zeroed until an admin marks the withdrawal paid, so without
  // this check the same balance could be requested repeatedly, stacking up
  // duplicate outstanding withdrawals for funds that only exist once.
  const { data: outstanding } = await supabase
    .from("withdrawals")
    .select("id")
    .eq("user_id", user.id)
    .in("status", ["pending", "approved"])
    .maybeSingle();

  if (outstanding) {
    return NextResponse.json(
      { error: "A withdrawal is already in progress for this account." },
      { status: 400 }
    );
  }

  const amount = user.usdt_balance;

  const { error: createError } = await supabase.from("withdrawals").insert({
    user_id: user.id,
    amount: amount,
    wallet_address: user.ton_wallet_address,
    status: "pending",
  });

  if (createError) {
    return NextResponse.json({ error: "Failed to create withdrawal request" }, { status: 500 });
  }

  const { data: updatedUser } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    success: true,
    amount: amount,
    user: updatedUser ? await withReferralCount(supabase, updatedUser) : updatedUser,
  });
}
