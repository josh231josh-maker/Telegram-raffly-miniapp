import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramInitData } from "@/lib/telegram-auth";
import { signAdRewardToken } from "@/lib/ad-reward-token";
import { RATE_LIMITS, rateLimitByIp, rateLimitByUser, rateLimitResponse } from "@/lib/rate-limit";

// Called once per ad-watch attempt, before the ad SDK is invoked -- mints a
// short-lived signed token binding this verified Telegram id, so the id an
// ad network later relays back in its postback can be checked rather than
// trusted outright. See lib/ad-reward-token.ts for why this exists.
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

  return NextResponse.json({ token: signAdRewardToken(tgUser.id) });
}
