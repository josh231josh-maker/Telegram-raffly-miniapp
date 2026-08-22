import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramInitData } from "@/lib/telegram-auth";
import { signAdRewardToken } from "@/lib/ad-reward-token";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { RATE_LIMITS, rateLimitByIp, rateLimitByUser, rateLimitResponse } from "@/lib/rate-limit";

// Called once per ad-watch attempt, before the ad SDK is invoked -- mints a
// short-lived signed token binding this verified Telegram id, so the id an
// ad network later relays back in its postback can be checked rather than
// trusted outright. See lib/ad-reward-token.ts for why this exists.
//
// This is also the enforcement point for the anti-abuse cooldown: record_ad_view
// sets users.ad_cooldown_until once someone watches 20 ads within an hour, and
// this route is what actually blocks them from starting another one while it's
// set -- refusing new tokens here is enough, since Monetag's postback can't
// credit a reward for an ad that was never started.
export async function POST(req: NextRequest) {
  const ipCheck = await rateLimitByIp(req, "adRewardTokenMint", RATE_LIMITS.adRewardTokenMint.ip);
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

  const userCheck = await rateLimitByUser(req, "adRewardTokenMint", tgUser.id, RATE_LIMITS.adRewardTokenMint.user);
  if (!userCheck.allowed) return rateLimitResponse(userCheck);

  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase
    .from("users")
    .select("ad_cooldown_until")
    .eq("telegram_id", tgUser.id)
    .maybeSingle();

  if (user?.ad_cooldown_until) {
    const cooldownUntilMs = new Date(user.ad_cooldown_until).getTime();
    if (cooldownUntilMs > Date.now()) {
      const retryAfterSeconds = Math.ceil((cooldownUntilMs - Date.now()) / 1000);
      return NextResponse.json(
        { error: "You've hit the ad-watching limit for now. Try again later.", cooldownUntil: user.ad_cooldown_until },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
    }
  }

  return NextResponse.json({ token: signAdRewardToken(tgUser.id) });
}
