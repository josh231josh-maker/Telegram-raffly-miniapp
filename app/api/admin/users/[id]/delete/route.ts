import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { RATE_LIMITS, rateLimitByIp, rateLimitResponse } from "@/lib/rate-limit";
import { logger, safeServerError } from "@/lib/logger";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ipCheck = await rateLimitByIp(req, "adminWrite", RATE_LIMITS.adminWrite.ip);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  // Removes the user's dependent rows (raffle entries, transactions, withdrawals,
  // etc.) and clears any referral links pointing at them before deleting the
  // account, since the foreign keys are NO ACTION rather than CASCADE.
  const { error } = await supabase.rpc("admin_delete_user", { p_user_id: id });

  if (error) {
    return NextResponse.json(safeServerError("admin.delete_user_failed", error, { userId: id }), { status: 500 });
  }

  logger.warn("admin.user_deleted", { userId: id });

  return NextResponse.json({ success: true });
}
