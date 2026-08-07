import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyTelegramInitData } from "@/lib/telegram-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/** Computed live from `referred_by` rather than a stored counter, so it can never drift out of sync. */
async function withReferralCount<T extends { id: string }>(supabase: SupabaseClient, user: T) {
  const [{ count }, { count: reachedCount }] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }).eq("referred_by", user.id),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("referred_by", user.id)
      .eq("referral_reward_given", true),
  ]);
  return { ...user, referral_count: count ?? 0, referral_reached_count: reachedCount ?? 0 };
}

export async function POST(req: NextRequest) {
  const { initData, startParam } = await req.json();
  if (!initData) {
    return NextResponse.json({ error: "Missing initData" }, { status: 400 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN!;
  const tgUser = verifyTelegramInitData(initData, botToken);
  if (!tgUser) {
    return NextResponse.json({ error: "Invalid initData" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const { data: existing } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", tgUser.id)
    .single();

  if (existing) {
    return NextResponse.json({ user: await withReferralCount(supabase, existing) });
  }

  let referredBy: string | null = null;
  if (startParam) {
    const referrerTelegramId = Number(startParam);
    if (!Number.isNaN(referrerTelegramId) && referrerTelegramId !== tgUser.id) {
      const { data: referrer } = await supabase
        .from("users")
        .select("id")
        .eq("telegram_id", referrerTelegramId)
        .single();
      if (referrer) {
        referredBy = referrer.id;
      }
    }
  }

  const { data: created, error } = await supabase
    .from("users")
    .insert({
      telegram_id: tgUser.id,
      username: tgUser.username ?? null,
      first_name: tgUser.first_name ?? null,
      referred_by: referredBy,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ user: await withReferralCount(supabase, created) });
}