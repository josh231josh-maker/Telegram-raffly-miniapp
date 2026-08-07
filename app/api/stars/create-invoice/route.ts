import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramInitData } from "@/lib/telegram-auth";
import { RAFFLY_PASS_STARS } from "@/lib/raffly-pass";

const TIERS: Record<string, { stars: number; tickets: number; label: string }> = {
  raffle10: { stars: 10, tickets: 12, label: "12 Raffle Tickets" },
  raffle50: { stars: 50, tickets: 70, label: "70 Raffle Tickets" },
  raffle100: { stars: 100, tickets: 150, label: "150 Raffle Tickets" },
  raffle250: { stars: 250, tickets: 400, label: "400 Raffle Tickets" },
  raffle500: { stars: 500, tickets: 850, label: "850 Raffle Tickets" },
  raffle1000: { stars: 1000, tickets: 1800, label: "1800 Raffle Tickets" },
  pass: { stars: RAFFLY_PASS_STARS, tickets: 0, label: "Raffly Pass — 30 Days" },
};

export async function POST(req: NextRequest) {
  const { initData, tier } = await req.json();
  if (!initData) {
    return NextResponse.json({ error: "Missing initData" }, { status: 400 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN!;
  const tgUser = verifyTelegramInitData(initData, botToken);
  if (!tgUser) {
    return NextResponse.json({ error: "Invalid initData" }, { status: 401 });
  }

  const selected = TIERS[tier];
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
    return NextResponse.json({ error: data.description ?? "Failed to create invoice" }, { status: 500 });
  }

  return NextResponse.json({ invoiceUrl: data.result });
}