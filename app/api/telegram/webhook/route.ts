import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { checkAndRewardReferral } from "@/lib/referral";
import { RAFFLY_PASS_DURATION_DAYS } from "@/lib/raffly-pass";
import { STARS_TIERS } from "@/lib/stars-tiers";
import { sendTelegramContent, buildInlineButtons, type ButtonInput } from "@/lib/telegram-bot";
import { timingSafeEqual } from "@/lib/timing-safe";
import { RATE_LIMITS, rateLimitByIp, rateLimitResponse } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

// Matches a bare "/start" (optionally "/start@BotName"), never "/start CODE".
// The referral system's deep-link codes arrive as Mini App `start_param`
// through initData (see app/api/auth/route.ts), not as a webhook text
// message, so this can never intercept or affect a referral code even in
// the classic-bot-deep-link case -- it only ever matches the no-argument form.
const BARE_START_REGEX = /^\/start(@\w+)?\s*$/;

export async function POST(req: NextRequest) {
  const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
  if (!timingSafeEqual(secretHeader, process.env.TELEGRAM_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ipCheck = await rateLimitByIp(req, "telegramWebhook", RATE_LIMITS.telegramWebhook.ip);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const update = await req.json();
  const botToken = process.env.TELEGRAM_BOT_TOKEN!;

  if (update.pre_checkout_query) {
    const query = update.pre_checkout_query;

    // Verify the payload and charge amount against our own tier prices
    // before approving — this is the only checkpoint before Telegram
    // actually takes the user's Stars, so a mismatch here must block it.
    const [, ticketsStr, tier] = String(query.invoice_payload).split(":");
    const expectedTickets = Number(ticketsStr);
    const selected = STARS_TIERS[tier];

    const valid =
      !!selected &&
      !Number.isNaN(expectedTickets) &&
      selected.tickets === expectedTickets &&
      selected.stars === query.total_amount;

    await fetch(`https://api.telegram.org/bot${botToken}/answerPreCheckoutQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        valid
          ? { pre_checkout_query_id: query.id, ok: true }
          : {
              pre_checkout_query_id: query.id,
              ok: false,
              error_message: "This invoice is no longer valid. Please try again.",
            }
      ),
    });
    return NextResponse.json({ ok: true });
  }

  const payment = update.message?.successful_payment;
  if (payment) {
    const [telegramIdStr, ticketsStr, tier] = String(payment.invoice_payload).split(":");
    const telegramId = Number(telegramIdStr);
    const tickets = Number(ticketsStr);

    // Re-validate against our own tier table at the moment we're about to
    // credit money's worth of tickets, not just at pre-checkout time. This
    // is defense in depth: Telegram's payload is opaque to the client and
    // pre_checkout_query already gates on the same check, but re-checking
    // here means a config change or an edge case that skips pre-checkout
    // can never result in crediting an amount that doesn't match what was
    // actually paid.
    const selected = STARS_TIERS[tier];
    const validPayment =
      !Number.isNaN(telegramId) &&
      !Number.isNaN(tickets) &&
      !!selected &&
      selected.tickets === tickets &&
      selected.stars === payment.total_amount;

    if (!validPayment) {
      logger.error("stars.payment_payload_mismatch", {
        telegramId: Number.isNaN(telegramId) ? undefined : telegramId,
        tier,
        chargeId: payment.telegram_payment_charge_id,
      });
      return NextResponse.json({ ok: true });
    }

    const supabase = getSupabaseAdmin();
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", telegramId)
      .single();

    if (!user) {
      logger.error("stars.payment_user_not_found", {
        telegramId,
        chargeId: payment.telegram_payment_charge_id,
      });
      return NextResponse.json({ ok: true });
    }

    // Telegram retries webhook delivery on timeout/non-2xx, so the same
    // successful_payment can arrive more than once. Recording the dedupe row
    // and crediting the ticket/pass balance happen atomically inside one DB
    // function -- if either half fails, both roll back together, so a
    // genuine retry can still succeed instead of the dedupe row silently
    // blocking crediting forever.
    const { data: credited, error: creditError } = await supabase.rpc("credit_stars_payment", {
      p_user_id: user.id,
      p_external_ref: payment.telegram_payment_charge_id,
      p_amount: payment.total_amount,
      p_tickets: tickets,
      p_is_pass: tier === "pass",
      p_pass_days: RAFFLY_PASS_DURATION_DAYS,
    });

    if (creditError) {
      logger.error("stars.payment_credit_failed", {
        userId: user.id,
        chargeId: payment.telegram_payment_charge_id,
        error: creditError.message,
      });
      // Non-2xx so Telegram redelivers this update -- nothing was persisted
      // (the dedupe insert rolled back with the failed credit), so a retry
      // can genuinely complete it rather than being blocked as a duplicate.
      return NextResponse.json({ error: "Failed to credit payment" }, { status: 500 });
    }

    if (!credited) {
      // external_ref already recorded -- this charge was already processed.
      logger.warn("stars.payment_duplicate_delivery", {
        userId: user.id,
        chargeId: payment.telegram_payment_charge_id,
      });
      return NextResponse.json({ ok: true });
    }

    logger.info("stars.payment_credited", { userId: user.id, tier, tickets, stars: payment.total_amount });

    await checkAndRewardReferral(supabase, user.id);
    return NextResponse.json({ ok: true });
  }

  const text = update.message?.text;
  const chatId = update.message?.chat?.id;
  if (typeof text === "string" && chatId && BARE_START_REGEX.test(text.trim())) {
    const supabase = getSupabaseAdmin();
    const { data: settings } = await supabase
      .from("welcome_message_settings")
      .select("*")
      .eq("id", true)
      .single();

    if (settings?.enabled && settings.message_html?.trim()) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
      const buttons = (settings.buttons ?? []) as ButtonInput[];
      await sendTelegramContent(botToken, chatId, settings.message_html, {
        imageUrl: settings.image_url,
        buttons: buildInlineButtons(buttons, appUrl),
      });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
