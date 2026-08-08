import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramInitData } from "@/lib/telegram-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getOrCreateCurrentRaffle } from "@/lib/raffle-week";
import { withReferralCount } from "@/lib/referral";

export async function GET(req: NextRequest) {
  const initData = req.nextUrl.searchParams.get("initData");
  if (!initData) {
    return NextResponse.json({ error: "Missing initData" }, { status: 400 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN!;
  const tgUser = verifyTelegramInitData(initData, botToken);
  if (!tgUser) {
    return NextResponse.json({ error: "Invalid initData" }, { status: 401 });
  }

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
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
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