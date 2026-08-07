import { NextResponse } from "next/server";
import crypto from "crypto";

// Temporary diagnostic endpoint — signs a valid initData for a given
// throwaway test telegram_id (passed via ?id=) and calls the real
// /api/withdraw route, so the actual production code path can be verified
// end-to-end without a live Telegram client. Remove once confirmed working.

function signInitData(botToken: string, telegramId: number) {
  const user = JSON.stringify({ id: telegramId, first_name: "WithdrawTest" });
  const authDate = Math.floor(Date.now() / 1000).toString();
  const params = new URLSearchParams();
  params.set("user", user);
  params.set("auth_date", authDate);

  const pairs: string[] = [];
  params.forEach((value, key) => pairs.push(`${key}=${value}`));
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  params.set("hash", hash);
  return params.toString();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const telegramId = Number(url.searchParams.get("id"));
  if (!telegramId) {
    return NextResponse.json({ error: "Missing ?id=" }, { status: 400 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN!;
  const initData = signInitData(botToken, telegramId);

  const res = await fetch(`${url.origin}/api/withdraw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData }),
  });

  const data = await res.json();
  return NextResponse.json({ status: res.status, data });
}
