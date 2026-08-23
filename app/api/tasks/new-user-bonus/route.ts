import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramInitData } from "@/lib/telegram-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { checkAndRewardReferral, withReferralCount } from "@/lib/referral";
import { NEW_USER_BONUS_TICKETS } from "@/lib/new-user-bonus";
import { RATE_LIMITS, rateLimitByIp, rateLimitByUser, rateLimitResponse } from "@/lib/rate-limit";
import { safeServerError } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const ipCheck = await rateLimitByIp(req, "newUserBonus", RATE_LIMITS.newUserBonus.ip);
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

  const userCheck = await rateLimitByUser(req, "newUserBonus", tgUser.id, RATE_LIMITS.newUserBonus.user);
  if (!userCheck.allowed) return rateLimitResponse(userCheck);

  const supabase = getSupabaseAdmin();

  const { data: existing, error: fetchError } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", tgUser.id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (existing.new_user_bonus_claimed_at) {
    return NextResponse.json({
      alreadyClaimed: true,
      user: await withReferralCount(supabase, existing),
    });
  }

  const { data: newBalance, error: rpcError } = await supabase.rpc("claim_new_user_bonus", {
    p_user_id: existing.id,
    p_reward: NEW_USER_BONUS_TICKETS,
  });

  if (rpcError) {
    return NextResponse.json(
      safeServerError("tasks.new_user_bonus_rpc_failed", rpcError, { userId: existing.id }),
      { status: 500 }
    );
  }

  if (newBalance === null) {
    return NextResponse.json({
      alreadyClaimed: true,
      user: await withReferralCount(supabase, existing),
    });
  }

  await checkAndRewardReferral(supabase, existing.id);

  const { data: updated } = await supabase.from("users").select("*").eq("id", existing.id).single();

  return NextResponse.json({
    claimed: true,
    ticketsEarned: NEW_USER_BONUS_TICKETS,
    user: await withReferralCount(supabase, updated),
  });
}
