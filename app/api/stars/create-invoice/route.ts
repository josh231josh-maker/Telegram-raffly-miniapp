import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramInitData } from "@/lib/telegram-auth";
import { RAFFLY_PASS_STARS } from "@/lib/raffly-pass";

// TODO: raise back to real prices (10/50/100) before launch
// Diagnostic: entry temporarily at 3 stars (not 1) to test whether a 1-star
// XTR invoice is what's hanging on Telegram's own confirm screen.
const TIERS: Record<string, { stars: number; tickets: number; label: string }> = {
  entry: { stars: 3, tickets: 15, label: "Entry Pack — 15 Tickets" },
  better: { stars: 1, tickets: 90, label: "Better Value — 90 Tickets" },
  best: { stars: 1, tickets: 200, label: "Best Value — 200 Tickets" },
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