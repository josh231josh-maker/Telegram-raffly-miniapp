import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { checkAndRewardReferral } from "@/lib/referral";



export async function POST(req: NextRequest) {
  const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
  if (secretHeader !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const update = await req.json();
  const botToken = process.env.TELEGRAM_BOT_TOKEN!;

  if (update.pre_checkout_query) {
    const query = update.pre_checkout_query;
    await fetch(`https://api.telegram.org/bot${botToken}/answerPreCheckoutQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pre_checkout_query_id: query.id, ok: true }),
    });
    return NextResponse.json({ ok: true });
  }

  const payment = update.message?.successful_payment;
  if (payment) {
    const [telegramIdStr, ticketsStr] = String(payment.invoice_payload).split(":");
    const telegramId = Number(telegramIdStr);
    const tickets = Number(ticketsStr);

    if (!Number.isNaN(telegramId) && !Number.isNaN(tickets)) {
      const supabase = getSupabaseAdmin();
      const { data: user } = await supabase
        .from("users")
        .select("id, ticket_balance")
        .eq("telegram_id", telegramId)
        .single();

      if (user) {
        await supabase
          .from("users")
          .update({ ticket_balance: user.ticket_balance + tickets })
          .eq("id", user.id);

        await checkAndRewardReferral(supabase, user.id);
      }
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}