import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramInitData } from "@/lib/telegram-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { withReferralCount } from "@/lib/referral";
import { sanitizeProfileText } from "@/lib/sanitize";
import { RATE_LIMITS, rateLimitByIp, rateLimitByUser, rateLimitResponse } from "@/lib/rate-limit";
import { safeServerError } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const ipCheck = await rateLimitByIp(req, "auth", RATE_LIMITS.auth.ip);
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

  const userCheck = await rateLimitByUser("auth", tgUser.id, RATE_LIMITS.auth.user);
  if (!userCheck.allowed) return rateLimitResponse(userCheck);

  const supabase = getSupabaseAdmin();

  const { data: existing } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", tgUser.id)
    .single();

  if (existing) {
    return NextResponse.json({ user: await withReferralCount(supabase, existing) });
  }

  let referredBy: string | null = null;
  if (tgUser.startParam) {
    const referrerTelegramId = Number(tgUser.startParam);
    if (!Number.isNaN(referrerTelegramId) && referrerTelegramId !== tgUser.id) {
      const { data: referrer } = await supabase
        .from("users")
        .select("id")
        .eq("telegram_id", referrerTelegramId)
        .single();
      if (referrer) {
        referredBy = referrer.id;
      }
    }
  }

  const { data: created, error } = await supabase
    .from("users")
    .insert({
      telegram_id: tgUser.id,
      username: sanitizeProfileText(tgUser.username),
      first_name: sanitizeProfileText(tgUser.first_name),
      referred_by: referredBy,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      safeServerError("auth.create_user_failed", error, { telegramId: tgUser.id }),
      { status: 500 }
    );
  }

  return NextResponse.json({ user: await withReferralCount(supabase, created) });
}