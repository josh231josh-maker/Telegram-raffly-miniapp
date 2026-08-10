import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramInitData } from "@/lib/telegram-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { RAFFLY_PASS_DAILY_TICKETS, isPassActive } from "@/lib/raffly-pass";
import { withReferralCount } from "@/lib/referral";
import { RATE_LIMITS, rateLimitByIp, rateLimitByUser, rateLimitResponse } from "@/lib/rate-limit";
import { safeServerError } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const ipCheck = await rateLimitByIp(req, "passClaim", RATE_LIMITS.passClaim.ip);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const { initData } = await req.json();
  if (!initData) {
    return NextResponse.json({ error: "Missing initData" }, { status: 400 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN!;
  const tgUser = verifyTelegramInitData(initData, botToken);
  if (!tgUser) {
    return NextResponse.json({ error: "Invalid initData" }, { status: 401 });
  }

  const userCheck = await rateLimitByUser(req, "passClaim", tgUser.id, RATE_LIMITS.passClaim.user);
  if (!userCheck.allowed) return rateLimitResponse(userCheck);

  const supabase = getSupabaseAdmin();

  const { data: existing, error: fetchError } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", tgUser.id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (!isPassActive(existing.raffly_pass_expires_at)) {
    return NextResponse.json({ error: "No active Raffly Pass" }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  if (existing.raffly_pass_last_claim_date === today) {
    return NextResponse.json({
      alreadyClaimed: true,
      user: await withReferralCount(supabase, existing),
    });
  }

  const { data: newBalance, error: rpcError } = await supabase.rpc("try_claim_pass_tickets", {
    p_user_id: existing.id,
    p_today: today,
    p_tickets: RAFFLY_PASS_DAILY_TICKETS,
  });

  if (rpcError) {
    return NextResponse.json(
      safeServerError("raffly_pass.claim_rpc_failed", rpcError, { userId: existing.id }),
      { status: 500 }
    );
  }

  if (newBalance === null) {
    return NextResponse.json({
      alreadyClaimed: true,
      user: await withReferralCount(supabase, existing),
    });
  }

  const { data: updated } = await supabase.from("users").select("*").eq("id", existing.id).single();

  return NextResponse.json({
    alreadyClaimed: false,
    ticketsEarned: RAFFLY_PASS_DAILY_TICKETS,
    user: await withReferralCount(supabase, updated),
  });
}
