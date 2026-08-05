import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { checkAndRewardReferral } from "@/lib/referral";

const ADS_TO_TICKET_RATIO = 2;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userid");
  const secret = searchParams.get("secret");

  if (secret !== process.env.ADSGRAM_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!userId) {
    return NextResponse.json({ error: "Missing userid" }, { status: 400 });
  }

  const telegramId = Number(userId);
  if (Number.isNaN(telegramId)) {
    return NextResponse.json({ error: "Invalid userid" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, ticket_balance")
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

    await supabase
      .from("users")
      await supabase
      .from("users")
      .update({ ticket_balance: user.ticket_balance + 1 })
      .eq("id", user.id);

    await checkAndRewardReferral(supabase, user.id);
  }

  return NextResponse.json({ success: true });
}