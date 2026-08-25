import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramInitData } from "@/lib/telegram-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { withReferralCount } from "@/lib/referral";
import { sanitizeProfileText } from "@/lib/sanitize";
import { RATE_LIMITS, rateLimitByIp, rateLimitByUser, rateLimitResponse } from "@/lib/rate-limit";
import { safeServerError } from "@/lib/logger";

// Telegram's CDN URLs run well under this, but keep enough headroom that a
// slightly longer one is never truncated into something broken.
function sanitizePhotoUrl(value: string | undefined): string | null {
  const cleaned = sanitizeProfileText(value, 512);
  return cleaned && cleaned.startsWith("https://") ? cleaned : null;
}

// Vercel's edge network adds this header to every request before it reaches
// the function -- a two-letter ISO 3166-1 code geolocated from the caller's
// real IP. This route is the right place to read it specifically because
// it's called directly from the user's own device on every Mini App open;
// the Telegram bot webhook, by contrast, is called from Telegram's own
// server infrastructure, so this header there would describe Telegram's
// datacenter, not the user. Only the derived country is ever stored -- the
// IP address itself never reaches application code.
function countryFromRequest(req: NextRequest): string | null {
  const code = req.headers.get("x-vercel-ip-country");
  return code && /^[A-Z]{2}$/.test(code) ? code : null;
}

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
    // Telegram's photo_url isn't in the HMAC-covered initData fields we
    // already trust for anything else, but it comes from the same signed
    // payload, so refreshing it here keeps an existing user's avatar current
    // without touching balances or any other account state on this hot
    // path. country_code rides along the same conditional update since it's
    // just as cheap to keep current on every open (a traveling user's
    // country reflects their most recent session, not a first-touch value).
    const photoUrl = sanitizePhotoUrl(tgUser.photoUrl);
    const countryCode = countryFromRequest(req);
    const updates: Record<string, string | null> = {};
    if (photoUrl !== existing.photo_url) updates.photo_url = photoUrl;
    if (countryCode && countryCode !== existing.country_code) updates.country_code = countryCode;

    if (Object.keys(updates).length > 0) {
      const { data: updated } = await supabase
        .from("users")
        .update(updates)
        .eq("id", existing.id)
        .select()
        .single();
      if (updated) {
        return NextResponse.json({ user: await withReferralCount(supabase, updated) });
      }
    }
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
      photo_url: sanitizePhotoUrl(tgUser.photoUrl),
      referred_by: referredBy,
      acquisition_link_code: acquisitionLinkCode,
      country_code: countryFromRequest(req),
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