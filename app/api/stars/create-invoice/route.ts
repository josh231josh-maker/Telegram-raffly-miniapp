import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramInitData } from "@/lib/telegram-auth";
import { STARS_TIERS } from "@/lib/stars-tiers";
import { RATE_LIMITS, rateLimitByIp, rateLimitByUser, rateLimitResponse } from "@/lib/rate-limit";
import { safeServerError } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const ipCheck = await rateLimitByIp(req, "createInvoice", RATE_LIMITS.createInvoice.ip);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const { initData, tier } = await req.json();
  if (!initData) {
    return NextResponse.json({ error: "Missing initData" }, { status: 400 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN!;
  const tgUser = verifyTelegramInitData(initData, botToken);
  if (!tgUser) {
    return NextResponse.json({ error: "Invalid initData" }, { status: 401 });
  }

  const userCheck = await rateLimitByUser("createInvoice", tgUser.id, RATE_LIMITS.createInvoice.user);
  if (!userCheck.allowed) return rateLimitResponse(userCheck);

  const selected = STARS_TIERS[tier];
  if (!selected) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }

  const payload = `${tgUser.id}:${selected.tickets}:${tier}`;
  const description =
    tier === "pass"
      ? "Unlock Raffly Pass: 20 tickets/day, 2x rewards, for 30 days"
      : `Get ${selected.tickets} raffle tickets for Raffly`;

  const res = await fetch(`https://api.telegram.org/bot${botToken}/createInvoiceLink`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: selected.label,
      description,
      payload,
      currency: "XTR",
      prices: [{ label: selected.label, amount: selected.stars }],
    }),
  });

  const data = await res.json();
  if (!data.ok) {
    return NextResponse.json(
      safeServerError(
        "stars.create_invoice_failed",
        new Error(data.description ?? "Telegram createInvoiceLink failed"),
        { telegramId: tgUser.id, tier },
        "Failed to create invoice"
      ),
      { status: 500 }
    );
  }

  return NextResponse.json({ invoiceUrl: data.result });
}