import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramInitData } from "@/lib/telegram-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { withReferralCount } from "@/lib/referral";
import { sanitizeProfileText } from "@/lib/sanitize";
import { RATE_LIMITS, rateLimitByIp, rateLimitByUser, rateLimitResponse } from "@/lib/rate-limit";
import { safeServerError } from "@/lib/logger";

// Granted once, on first sign-in, to every new user regardless of how they
// arrived (referred or not) -- distinct from REFERRAL_REWARD_TICKETS, which
// only pays the referrer once their invitee crosses the ticket threshold.
const NEW_USER_REWARD_TICKETS = 50;

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

  const userCheck = await rateLimitByUser(req, "auth", tgUser.id, RATE_LIMITS.auth.user);
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

  // A startParam is either a referral (the referrer's raw telegram_id, always
  // numeric) or an admin-generated tracking-link code (always starts with a
  // letter -- see generateCode() in the tracking-links admin route). Numeric
  // wins the branch below; anything else is looked up as a tracking link.
  // Both are first-touch, set once at signup, same as each other.
  let referredBy: string | null = null;
  let acquisitionLinkCode: string | null = null;
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
    } else if (Number.isNaN(referrerTelegramId)) {
      const { data: link } = await supabase
        .from("tracking_links")
        .select("code")
        .eq("code", tgUser.startParam)
        .single();
      if (link) {
        acquisitionLinkCode = link.code;
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
      acquisition_link_code: acquisitionLinkCode,
      ticket_balance: NEW_USER_REWARD_TICKETS,
    })
    .select()
    .single();

  if (error) {
    // A flaky connection can make the client retry this same first-signup
    // call while the earlier attempt actually landed -- telegram_id is
    // unique, so the loser of that race hits a 23505 here rather than
    // creating a duplicate account. Treat it the same as the "already
    // exists" branch above instead of surfacing a raw 500 for what's really
    // just a sign-in.
    if (error.code === "23505") {
      const { data: winner } = await supabase
        .from("users")
        .select("*")
        .eq("telegram_id", tgUser.id)
        .single();
      if (winner) {
        return NextResponse.json({ user: await withReferralCount(supabase, winner) });
      }
    }
    return NextResponse.json(
      safeServerError("auth.create_user_failed", error, { telegramId: tgUser.id }),
      { status: 500 }
    );
  }

  return NextResponse.json({
    user: await withReferralCount(supabase, created),
    isNewUser: true,
  });
}