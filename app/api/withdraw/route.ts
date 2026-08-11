import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramInitData } from "@/lib/telegram-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { withReferralCount } from "@/lib/referral";
import { RATE_LIMITS, rateLimitByIp, rateLimitByUser, rateLimitResponse } from "@/lib/rate-limit";
import { logger, safeServerError } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const ipCheck = await rateLimitByIp(req, "withdraw", RATE_LIMITS.withdraw.ip);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const { initData } = await req.json();
  if (!initData) {
    return NextResponse.json({ error: "Missing initData" }, { status: 400 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN!;
  const tgUser = verifyTelegramInitData(initData, botToken);
  if (!tgUser) {
    return NextResponse.json({ error: "Invalid initData" }, { status: 401 });
  }

  const userCheck = await rateLimitByUser(req, "withdraw", tgUser.id, RATE_LIMITS.withdraw.user);
  if (!userCheck.allowed) return rateLimitResponse(userCheck);

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

  // Atomically locks the user row, re-validates balance/wallet, zeroes
  // usdt_balance, and records the pending withdrawal in one transaction --
  // so the requested amount is reserved immediately (the balance can't be
  // spent twice or requested again) instead of staying visible/withdrawable
  // until an admin eventually marks it paid. withdrawals_one_active_per_user
  // still backs this at the database level: if a concurrent request already
  // reserved a withdrawal for this user, this insert fails with 23505 no
  // matter how the timing lines up.
  const { data: result, error: rpcError } = (await supabase
    .rpc("process_withdrawal", { p_user_id: user.id })
    .maybeSingle()) as {
    data: { out_amount: number; out_wallet_address: string } | null;
    error: { code?: string; message?: string } | null;
  };

  if (rpcError) {
    if (rpcError.code === "23505") {
      return NextResponse.json(
        { error: "A withdrawal is already in progress for this account." },
        { status: 409 }
      );
    }
    if (rpcError.message?.includes("No balance to withdraw")) {
      return NextResponse.json({ error: "No balance available for withdrawal" }, { status: 400 });
    }
    if (rpcError.message?.includes("No wallet connected")) {
      return NextResponse.json({ error: "No wallet connected" }, { status: 400 });
    }
    return NextResponse.json(
      safeServerError("withdraw.create_failed", rpcError, { userId: user.id }, "Failed to create withdrawal request"),
      { status: 500 }
    );
  }

  logger.info("withdraw.created", { userId: user.id, amount: result?.out_amount });

  const { data: updatedUser } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    success: true,
    amount: result?.out_amount,
    user: updatedUser ? await withReferralCount(supabase, updatedUser) : updatedUser,
  });
}
