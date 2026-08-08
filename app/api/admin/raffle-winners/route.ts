import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const adminUser = await verifyAdminAuth();
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const statusFilter = req.nextUrl.searchParams.get("status") || "pending";

  const { data: winners, error } = await supabase
    .from("raffle_winners")
    .select(
      `
      id,
      raffle_id,
      user_id,
      prize_amount,
      status,
      week_label,
      created_at,
      paid_at,
      users:user_id(id, telegram_id, username, first_name, usdt_balance),
      raffles:raffle_id(id, week_end, status)
    `
    )
    .eq("status", statusFilter)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ winners });
}
