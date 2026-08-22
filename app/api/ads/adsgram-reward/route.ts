import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { checkAndRewardReferral } from "@/lib/referral";
import { isPassActive } from "@/lib/raffly-pass";
import { timingSafeEqual } from "@/lib/timing-safe";
import { verifyAdRewardToken } from "@/lib/ad-reward-token";
import { RATE_LIMITS, rateLimitByIp, rateLimitByUser, rateLimitResponse } from "@/lib/rate-limit";
import { logger, safeServerError } from "@/lib/logger";

const ADS_TO_TICKET_RATIO = 2;

// Re-added after being retired for trusting a raw client-supplied userid
// gated only by a static shared secret -- a live ticket-farming hole for
// anyone who ever learned that secret (see the retirement commit on this
// file). Rebuilt to match monetag-postback/route.ts's trust model instead:
// AdsGram's postback macro is still literally named "userid" (that's fixed
// by their platform, not something we control), but whatever client
// integration triggers the ad must pass our own signed ad-reward token
// (from /api/ads/mint-reward-token, via lib/ad-reward-token.ts) as AdsGram's
// user id value -- NOT the raw Telegram id. That's what gets verified here,
// the same way Monetag's ymid is. No AdsGram client wiring exists yet
// (the hook was removed as dead code); when it's rebuilt, it needs to mint
// that token first and hand it to AdsGram's SDK as the user identifier.
export async function GET(req: NextRequest) {
  const ipCheck = await rateLimitByIp(req, "adReward", RATE_LIMITS.adReward.ip);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const { searchParams } = new URL(req.url);
  const userid = searchParams.get("userid");
  const secret = searchParams.get("secret");

  if (!timingSafeEqual(secret, process.env.ADSGRAM_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const telegramId = verifyAdRewardToken(userid);
  if (telegramId === null) {
    logger.warn("ads.adsgram_invalid_token", { userid });
    return NextResponse.json({ error: "Invalid or expired userid" }, { status: 401 });
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

  // Same replay defense as Monetag: hash the token and let record_ad_view's
  // unique constraint on token_hash reject a redelivered/replayed postback
  // as a no-op instead of a second credited view.
  const tokenHash = crypto.createHash("sha256").update(userid!).digest("hex");

  const { data: ticketsAwarded, error: rpcError } = await supabase.rpc("record_ad_view", {
    p_user_id: user.id,
    p_ratio: ADS_TO_TICKET_RATIO,
    p_reward: baseReward,
    p_token_hash: tokenHash,
  });

  if (rpcError) {
    return NextResponse.json(
      safeServerError("ads.adsgram_rpc_failed", rpcError, { userId: user.id }),
      { status: 500 }
    );
  }

  if (ticketsAwarded === -1) {
    return NextResponse.json({ success: true, duplicate: true });
  }

  if (ticketsAwarded > 0) {
    await checkAndRewardReferral(supabase, user.id);
  }

  return NextResponse.json({ success: true });
}
