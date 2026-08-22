import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { checkAndRewardReferral } from "@/lib/referral";
import { isPassActive } from "@/lib/raffly-pass";
import { timingSafeEqual } from "@/lib/timing-safe";
import { RATE_LIMITS, rateLimitByIp, rateLimitByUser, rateLimitResponse } from "@/lib/rate-limit";
import { safeServerError } from "@/lib/logger";

const ADS_TO_TICKET_RATIO = 2;

// Re-added after being retired for trusting a raw client-supplied userid
// gated only by a static shared secret (see the retirement commit on this
// file). The originally-planned fix -- verifying a signed token the same
// way monetag-postback does -- turned out not to be possible: AdsGram's
// reward postback only ever offers a single macro, [userId], which their
// own SDK fills in from the Telegram WebApp context directly. There's no
// slot for an app-supplied opaque value the way Monetag's ymid works, so
// there's no per-session binding to fall back on here -- this is the
// platform's ceiling, not a fixable implementation gap. Accepted
// consciously: the secret is never present in any client code (AdsGram
// calls this server-to-server only), and record_ad_view's 20-views/hour
// cooldown (see lib/auto-entry.ts's sibling logic in record_ad_view) caps
// how much a leaked secret could still be worth per account even with zero
// replay protection at the request level. Same trust-gap shape already
// documented for the `adReward` rate-limit scope in lib/rate-limit.ts.
export async function GET(req: NextRequest) {
  const ipCheck = await rateLimitByIp(req, "adReward", RATE_LIMITS.adReward.ip);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const { searchParams } = new URL(req.url);
  const userid = searchParams.get("userid");
  const secret = searchParams.get("secret");

  if (!timingSafeEqual(secret, process.env.ADSGRAM_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const telegramId = Number(userid);
  if (!userid || !Number.isFinite(telegramId)) {
    return NextResponse.json({ error: "Invalid userid" }, { status: 400 });
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

  // No token_hash here -- unlike Monetag/ymid, there's no per-request nonce
  // AdsGram gives us to dedupe against, so this can't reject an exact
  // replay the way record_ad_view does for the other networks. The
  // rate limits above plus the 20-views/hour cooldown are what actually
  // bound the damage instead.
  const { data: ticketsAwarded, error: rpcError } = await supabase.rpc("record_ad_view", {
    p_user_id: user.id,
    p_ratio: ADS_TO_TICKET_RATIO,
    p_reward: baseReward,
  });

  if (rpcError) {
    return NextResponse.json(
      safeServerError("ads.adsgram_rpc_failed", rpcError, { userId: user.id }),
      { status: 500 }
    );
  }

  if (ticketsAwarded === -2) {
    // In cooldown -- record_ad_view refused to record this view at all.
    // AdsGram has no pre-check step before showing an ad the way Monetag's
    // token mint does, so this is the only place that can actually catch
    // it; nothing to credit, nothing to roll back.
    return NextResponse.json({ success: true, cooldown: true });
  }

  if (ticketsAwarded > 0) {
    await checkAndRewardReferral(supabase, user.id);
  }

  return NextResponse.json({ success: true });
}
