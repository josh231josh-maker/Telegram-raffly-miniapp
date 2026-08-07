import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramInitData } from "@/lib/telegram-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { withReferralCount } from "@/lib/referral";

export async function POST(req: NextRequest) {
  const { initData } = await req.json();
  if (!initData) {
    return NextResponse.json({ error: "Missing initData" }, { status: 400 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN!;
  const tgUser = verifyTelegramInitData(initData, botToken);
  if (!tgUser) {
    return NextResponse.json({ error: "Invalid initData" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const { data: existing, error: fetchError } = await supabase
    .from("users")
    .select("id")
    .eq("telegram_id", tgUser.id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Balance check, wallet check, balance-zeroing, and the withdrawal record
  // all happen inside a single Postgres transaction (see the
  // process_withdrawal migration), so a failure partway through can't leave
  // a zeroed balance with no withdrawal record to show for it.
  const { data: result, error: withdrawError } = await supabase
    .rpc("process_withdrawal", { p_user_id: existing.id })
    .single();

  if (withdrawError) {
    const message = withdrawError.message ?? "Something went wrong";
    const status =
      message.includes("No balance") || message.includes("No wallet") || message.includes("not found")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }

  const { data: updatedUser } = await supabase
    .from("users")
    .select("*")
    .eq("id", existing.id)
    .single();

  return NextResponse.json({
    success: true,
    amount: (result as { out_amount: number } | null)?.out_amount,
    user: updatedUser ? await withReferralCount(supabase, updatedUser) : updatedUser,
  });
}
