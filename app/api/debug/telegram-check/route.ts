import { NextResponse } from "next/server";

// Temporary diagnostic endpoint — remove once the Stars invoice hang is root-caused.
export async function GET() {
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
