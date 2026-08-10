import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { checkAndRewardReferral } from "@/lib/referral";
import { RAFFLY_PASS_DURATION_DAYS } from "@/lib/raffly-pass";
import { STARS_TIERS } from "@/lib/stars-tiers";
import { sendTelegramContent, buildInlineButtons, type ButtonInput } from "@/lib/telegram-bot";
import { timingSafeEqual } from "@/lib/timing-safe";

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

    if (!Number.isNaN(telegramId) && !Number.isNaN(tickets)) {
      const supabase = getSupabaseAdmin();
      const { data: user } = await supabase
        .from("users")
        .select("id")
        .eq("telegram_id", telegramId)
        .single();

      if (user) {
        // Telegram retries webhook delivery on timeout/non-2xx, so the same
        // successful_payment can arrive more than once. This charge ID is
        // unique per payment, so a duplicate insert fails and we skip
        // crediting again rather than double-paying out.
        const { error: dedupeError } = await supabase.from("transactions").insert({
          user_id: user.id,
          type: "stars_purchase",
          currency: "STARS",
          amount: payment.total_amount,
          tickets_granted: tickets,
          status: "completed",
          external_ref: payment.telegram_payment_charge_id,
        });

        if (dedupeError) {
          // Unique violation on external_ref means this charge was already processed.
          return NextResponse.json({ ok: true });
        }

        if (tier === "pass") {
          await supabase.rpc("extend_raffly_pass", {
            p_user_id: user.id,
            p_days: RAFFLY_PASS_DURATION_DAYS,
          });
        } else {
          await supabase.rpc("increment_ticket_balance", {
            p_user_id: user.id,
            p_delta: tickets,
          });
        }

        await checkAndRewardReferral(supabase, user.id);
      }
    }
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
