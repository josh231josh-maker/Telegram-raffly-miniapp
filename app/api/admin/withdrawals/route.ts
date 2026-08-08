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

  const { data: withdrawals, error } = await supabase
    .from("withdrawals")
    .select(
      `
      id,
      user_id,
      amount,
      wallet_address,
      status,
      requested_at,
      processed_at,
      users:user_id(id, telegram_id, username, first_name, usdt_balance)
    `
    )
    .eq("status", statusFilter)
    .order("requested_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ withdrawals });
}
