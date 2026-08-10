import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramInitData } from "@/lib/telegram-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { RATE_LIMITS, rateLimitByIp, rateLimitByUser, rateLimitResponse } from "@/lib/rate-limit";
import { safeServerError } from "@/lib/logger";

// TON addresses come in two shapes: raw ("0:" + 64 hex chars) or the
// user-friendly base64url form (48 chars) that TonConnect normally returns.
const TON_RAW_ADDRESS = /^-?\d+:[0-9a-fA-F]{64}$/;
const TON_FRIENDLY_ADDRESS = /^[A-Za-z0-9_-]{48}$/;

function isValidTonAddress(value: unknown): value is string {
  return typeof value === "string" && (TON_RAW_ADDRESS.test(value) || TON_FRIENDLY_ADDRESS.test(value));
}

export async function POST(req: NextRequest) {
  const ipCheck = await rateLimitByIp(req, "walletConnect", RATE_LIMITS.walletConnect.ip);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const { initData, walletAddress } = await req.json();

  if (!initData) {
    return NextResponse.json({ error: "Missing initData" }, { status: 400 });
  }

  // walletAddress is only ever set by our own TonConnect integration or
  // cleared to null on disconnect -- reject anything else outright rather
  // than persisting an arbitrary client-supplied string as a payout address.
  if (walletAddress !== null && walletAddress !== undefined && !isValidTonAddress(walletAddress)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN!;
  const tgUser = verifyTelegramInitData(initData, botToken);
  if (!tgUser) {
    return NextResponse.json({ error: "Invalid initData" }, { status: 401 });
  }

  const userCheck = await rateLimitByUser("walletConnect", tgUser.id, RATE_LIMITS.walletConnect.user);
  if (!userCheck.allowed) return rateLimitResponse(userCheck);

  const supabase = getSupabaseAdmin();

  const { data: existing, error: fetchError } = await supabase
    .from("users")
    .select("id")
    .eq("telegram_id", tgUser.id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data: updated, error: updateError } = await supabase
    .from("users")
    .update({ ton_wallet_address: walletAddress ?? null })
    .eq("id", existing.id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json(
      safeServerError("wallet.connect_ton_failed", updateError, { userId: existing.id }),
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, user: updated });
}