import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { RATE_LIMITS, rateLimitByIp, rateLimitResponse } from "@/lib/rate-limit";
import { safeServerError } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const adminUser = await verifyAdminAuth();
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ipCheck = await rateLimitByIp(req, "adminRead", RATE_LIMITS.adminRead.ip);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

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
    .order("requested_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json(safeServerError("admin.withdrawals_list_failed", error), { status: 500 });
  }

  return NextResponse.json({ withdrawals });
}
