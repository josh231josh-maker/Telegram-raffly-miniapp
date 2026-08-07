import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { checkAndRewardReferral } from "@/lib/referral";
import { isPassActive } from "@/lib/raffly-pass";

const ADS_TO_TICKET_RATIO = 2;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ymid = searchParams.get("ymid");
  const value = searchParams.get("value");
  const secret = searchParams.get("secret");

  if (secret !== process.env.MONETAG_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (value !== "valued") {
    return NextResponse.json({ ok: true, skipped: "not_valued" });
  }

  if (!ymid) {
    return NextResponse.json({ error: "Missing ymid" }, { status: 400 });
  }

  const telegramId = Number(ymid);
  if (Number.isNaN(telegramId)) {
    return NextResponse.json({ error: "Invalid ymid" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, ticket_balance, raffly_pass_expires_at")
    .eq("telegram_id", telegramId)
    .single();

  if (userError || !user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await supabase.from("ad_views").insert({ user_id: user.id, converted: false });

  const { data: unconverted } = await supabase
    .from("ad_views")
    .select("id")
    .eq("user_id", user.id)
    .eq("converted", false)
    .order("viewed_at", { ascending: true });

  if (unconverted && unconverted.length >= ADS_TO_TICKET_RATIO) {
    const toConvert = unconverted.slice(0, ADS_TO_TICKET_RATIO).map((v) => v.id);

    await supabase
      .from("ad_views")
      .update({ converted: true })
      .in("id", toConvert);

    const ticketsAwarded = isPassActive(user.raffly_pass_expires_at) ? 2 : 1;

    await supabase
      .from("users")
      .update({ ticket_balance: user.ticket_balance + ticketsAwarded })
      .eq("id", user.id);

    await checkAndRewardReferral(supabase, user.id);
  }

  return NextResponse.json({ success: true });
}
