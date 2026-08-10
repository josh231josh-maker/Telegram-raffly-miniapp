import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramInitData } from "@/lib/telegram-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getOrCreateCurrentRaffle } from "@/lib/raffle-week";
import { withReferralCount } from "@/lib/referral";
import { RATE_LIMITS, rateLimitByIp, rateLimitByUser, rateLimitResponse } from "@/lib/rate-limit";
import { safeServerError } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const ipCheck = await rateLimitByIp(req, "raffleEntryRead", RATE_LIMITS.raffleEntryRead.ip);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const initData = req.nextUrl.searchParams.get("initData");
  if (!initData) {
    return NextResponse.json({ error: "Missing initData" }, { status: 400 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN!;
  const tgUser = verifyTelegramInitData(initData, botToken);
  if (!tgUser) {
    return NextResponse.json({ error: "Invalid initData" }, { status: 401 });
  }

  const userCheck = await rateLimitByUser(req, "raffleEntryRead", tgUser.id, RATE_LIMITS.raffleEntryRead.user);
  if (!userCheck.allowed) return rateLimitResponse(userCheck);

  const supabase = getSupabaseAdmin();

  const { data: user, error: fetchError } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", tgUser.id)
    .single();

  if (fetchError || !user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const raffle = await getOrCreateCurrentRaffle(supabase);

  const { data: entry } = await supabase
    .from("raffle_entries")
    .select("tickets_used")
    .eq("raffle_id", raffle.id)
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    raffleId: raffle.id,
    weekEnd: raffle.week_end,
    status: raffle.status,
    ticketsEntered: entry?.tickets_used ?? 0,
    ticketBalance: user.ticket_balance,
  });
}

export async function POST(req: NextRequest) {
  const ipCheck = await rateLimitByIp(req, "raffleEntryWrite", RATE_LIMITS.raffleEntryWrite.ip);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const { initData, ticketsToEnter } = await req.json();

  if (!initData) {
    return NextResponse.json({ error: "Missing initData" }, { status: 400 });
  }

  if (!Number.isInteger(ticketsToEnter) || ticketsToEnter <= 0) {
    return NextResponse.json(
      { error: "ticketsToEnter must be a positive whole number" },
      { status: 400 }
    );
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN!;
  const tgUser = verifyTelegramInitData(initData, botToken);
  if (!tgUser) {
    return NextResponse.json({ error: "Invalid initData" }, { status: 401 });
  }

  const userCheck = await rateLimitByUser(req, "raffleEntryWrite", tgUser.id, RATE_LIMITS.raffleEntryWrite.user);
  if (!userCheck.allowed) return rateLimitResponse(userCheck);

  const supabase = getSupabaseAdmin();

  const { data: user, error: fetchError } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", tgUser.id)
    .single();

  if (fetchError || !user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (ticketsToEnter > user.ticket_balance) {
    return NextResponse.json({ error: "Not enough tickets" }, { status: 400 });
  }

  const raffle = await getOrCreateCurrentRaffle(supabase);

  if (raffle.status !== "open") {
    return NextResponse.json(
      { error: "This week's raffle is no longer open for entries" },
      { status: 400 }
    );
  }

  // Atomic: spends the tickets and records the entry in one statement, so a
  // raced double-submit can never spend more tickets than the user has.
  const { data: newTicketsUsed, error: rpcError } = await supabase.rpc("enter_raffle", {
    p_user_id: user.id,
    p_raffle_id: raffle.id,
    p_tickets: ticketsToEnter,
  });

  if (rpcError) {
    // enter_raffle re-checks the raffle's status itself (row-locked, so it
    // can't race a concurrent draw) and raises one of these sentinels for
    // the expected business conditions -- surface those as clean 400s
    // instead of the generic 500 fallback.
    if (rpcError.message?.includes("RAFFLE_NOT_OPEN")) {
      return NextResponse.json(
        { error: "This week's raffle is no longer open for entries" },
        { status: 400 }
      );
    }
    if (rpcError.message?.includes("RAFFLE_NOT_FOUND")) {
      return NextResponse.json({ error: "Raffle not found" }, { status: 404 });
    }
    if (rpcError.message?.includes("INVALID_TICKET_COUNT")) {
      return NextResponse.json(
        { error: "ticketsToEnter must be a positive whole number" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      safeServerError("raffle_entry.rpc_failed", rpcError, { userId: user.id, raffleId: raffle.id }),
      { status: 500 }
    );
  }

  if (newTicketsUsed === null) {
    return NextResponse.json({ error: "Not enough tickets" }, { status: 400 });
  }

  const { data: updatedUser, error: fetchUpdatedError } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (fetchUpdatedError || !updatedUser) {
    return NextResponse.json({ error: "Failed to load updated balance" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    ticketsEntered: newTicketsUsed,
    user: await withReferralCount(supabase, updatedUser),
  });
}