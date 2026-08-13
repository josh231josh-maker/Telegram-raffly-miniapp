import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { RATE_LIMITS, rateLimitByIp, rateLimitResponse } from "@/lib/rate-limit";
import { safeServerError } from "@/lib/logger";
import { validateWinnerAnnouncementFields } from "@/lib/validation/winner-announcement";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminUser = await verifyAdminAuth();
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ipCheck = await rateLimitByIp(req, "adminWrite", RATE_LIMITS.adminWrite.ip);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const { display_name, prize_amount, week_label, publish_at } = await req.json();

  const validationError = validateWinnerAnnouncementFields({ display_name, prize_amount, week_label });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { id } = await params;

  type UpdateData = {
    display_name?: string;
    prize_amount?: number;
    week_label?: string;
    publish_at?: string;
  };
  const updateData: UpdateData = {};
  if (display_name !== undefined) updateData.display_name = display_name;
  if (prize_amount !== undefined) updateData.prize_amount = prize_amount;
  if (week_label !== undefined) updateData.week_label = week_label;
  if (publish_at !== undefined) updateData.publish_at = publish_at;

  const { data: announcement, error } = await supabase
    .from("winner_announcements")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(safeServerError("admin.winner_announcement_update_failed", error, { id }), { status: 500 });
  }

  return NextResponse.json({ success: true, announcement });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminUser = await verifyAdminAuth();
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ipCheck = await rateLimitByIp(req, "adminWrite", RATE_LIMITS.adminWrite.ip);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const supabase = getSupabaseAdmin();
  const { id } = await params;

  const { error } = await supabase.from("winner_announcements").delete().eq("id", id);

  if (error) {
    return NextResponse.json(safeServerError("admin.winner_announcement_delete_failed", error, { id }), { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Winner announcement deleted." });
}
