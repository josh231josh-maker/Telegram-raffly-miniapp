import { NextRequest, NextResponse } from "next/server";

// Temporary diagnostic endpoint — remove once the Stars invoice hang is root-caused.
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("action") === "setWebhook") {
    return reregisterWebhook();
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN!;

  const [meRes, webhookRes, invoiceRes] = await Promise.all([
    fetch(`https://api.telegram.org/bot${botToken}/getMe`).then((r) => r.json()),
    fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`).then((r) => r.json()),
    fetch(`https://api.telegram.org/bot${botToken}/createInvoiceLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Diagnostic Test",
        description: "Temporary diagnostic invoice",
        payload: `debug:${Date.now()}`,
        currency: "XTR",
        prices: [{ label: "Diagnostic Test", amount: 1 }],
      }),
    }).then((r) => r.json()),
  ]);

  return NextResponse.json({ me: meRes, webhookInfo: webhookRes, invoiceAttempt: invoiceRes });
}

// Re-registers the bot's webhook using this server's own env vars, so the
// secret never has to be typed/pasted anywhere by hand.
export async function POST() {
  return reregisterWebhook();
}

async function reregisterWebhook() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN!;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET!;
  const webhookUrl = "https://telegram-raffly-miniapp.vercel.app/api/telegram/webhook";

  const setRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ["pre_checkout_query", "message"],
    }),
  }).then((r) => r.json());

  const infoRes = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`).then((r) =>
    r.json()
  );

  return NextResponse.json({ setWebhook: setRes, webhookInfo: infoRes });
}
