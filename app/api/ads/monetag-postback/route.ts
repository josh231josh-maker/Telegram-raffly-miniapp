import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { checkAndRewardReferral } from "@/lib/referral";
import { isPassActive } from "@/lib/raffly-pass";
import { timingSafeEqual } from "@/lib/timing-safe";
import { verifyAdRewardToken } from "@/lib/ad-reward-token";
import { RATE_LIMITS, rateLimitByIp, rateLimitByUser, rateLimitResponse } from "@/lib/rate-limit";
import { logger, safeServerError } from "@/lib/logger";

const ADS_TO_TICKET_RATIO = 2;

export async function GET(req: NextRequest) {
  const ipCheck = await rateLimitByIp(req, "adReward", RATE_LIMITS.adReward.ip);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const { searchParams } = new URL(req.url);
  const ymid = searchParams.get("ymid");
  const value = searchParams.get("value");
  const secret = searchParams.get("secret");

  if (!timingSafeEqual(secret, process.env.MONETAG_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (value !== "valued") {
    return NextResponse.json({ ok: true, skipped: "not_valued" });
  }

  if (!ymid) {
    return NextResponse.json({ error: "Missing ymid" }, { status: 400 });
  }

  // ymid is a signed token (lib/ad-reward-token.ts), not a raw Telegram id --
  // Monetag has no way to carry Telegram's own signature through its
  // postback, so this is what proves the id being credited is really the
  // one that started the ad-watch flow, rather than whatever a hostile
  // client chose to hand the ad SDK.
  const telegramId = verifyAdRewardToken(ymid);
  if (telegramId === null) {
    logger.warn("ads.monetag_invalid_token", { ymid });
    return NextResponse.json({ error: "Invalid or expired ymid" }, { status: 401 });
  }

  const userCheck = await rateLimitByUser(req, "adReward", telegramId, RATE_LIMITS.adReward.user);
  if (!userCheck.allowed) return rateLimitResponse(userCheck);

  const supabase = getSupabaseAdmin();

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, raffly_pass_expires_at")
    .eq("telegram_id", telegramId)
    .single();

  if (userError || !user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const baseReward = isPassActive(user.raffly_pass_expires_at) ? 2 : 1;

  // Atomic: records the view and, once enough have piled up, converts and
  // credits in one row-locked transaction -- a retried postback for the
  // same user can't double-convert or double-credit.
  const { data: ticketsAwarded, error: rpcError } = await supabase.rpc("record_ad_view", {
    p_user_id: user.id,
    p_ratio: ADS_TO_TICKET_RATIO,
    p_reward: baseReward,
  });

  if (rpcError) {
    return NextResponse.json(
      safeServerError("ads.monetag_rpc_failed", rpcError, { userId: user.id }),
      { status: 500 }
    );
  }

  if (ticketsAwarded > 0) {
    await checkAndRewardReferral(supabase, user.id);
  }

  return NextResponse.json({ success: true });
}
