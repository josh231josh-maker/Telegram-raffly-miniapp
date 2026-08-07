import { NextResponse } from "next/server";
import crypto from "crypto";

// Temporary diagnostic endpoint — signs a valid initData for a designated
// throwaway test user and calls the real /api/withdraw route, so the actual
// production code path can be verified end-to-end without a live Telegram
// client. Remove once the withdraw flow is confirmed working.
const TEST_TELEGRAM_ID = 999999001;

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
  const botToken = process.env.TELEGRAM_BOT_TOKEN!;
  const initData = signInitData(botToken, TEST_TELEGRAM_ID);

  const origin = new URL(req.url).origin;
  const res = await fetch(`${origin}/api/withdraw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData }),
  });

  const data = await res.json();
  return NextResponse.json({ status: res.status, data });
}
