import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramInitData } from "@/lib/telegram-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getOrCreateCurrentRaffle } from "@/lib/raffle-week";

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

  const { data: existingEntry } = await supabase
    .from("raffle_entries")
    .select("*")
    .eq("raffle_id", raffle.id)
    .eq("user_id", user.id)
    .maybeSingle();

  const newTicketsUsed = (existingEntry?.tickets_used ?? 0) + ticketsToEnter;

  if (existingEntry) {
    const { error: updateEntryError } = await supabase
      .from("raffle_entries")
      .update({ tickets_used: newTicketsUsed })
      .eq("id", existingEntry.id);

    if (updateEntryError) {
      return NextResponse.json({ error: updateEntryError.message }, { status: 500 });
    }
  } else {
    const { error: insertEntryError } = await supabase.from("raffle_entries").insert({
      raffle_id: raffle.id,
      user_id: user.id,
      tickets_used: newTicketsUsed,
    });

    if (insertEntryError) {
      return NextResponse.json({ error: insertEntryError.message }, { status: 500 });
    }
  }

  const { data: updatedUser, error: updateUserError } = await supabase
    .from("users")
    .update({ ticket_balance: user.ticket_balance - ticketsToEnter })
    .eq("id", user.id)
    .select()
    .single();

  if (updateUserError) {
    return NextResponse.json({ error: updateUserError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    ticketsEntered: newTicketsUsed,
    user: updatedUser,
  });
}