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

  const { data: announcements, error } = await supabase
    .from("winner_announcements")
    .select("id, display_name, prize_amount, week_label, publish_at, created_at, raffle_winner_id")
    .order("publish_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json(safeServerError("admin.winner_announcements_list_failed", error), { status: 500 });
  }

  return NextResponse.json({ announcements });
}

export async function POST(req: NextRequest) {
  const adminUser = await verifyAdminAuth();
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ipCheck = await rateLimitByIp(req, "adminWrite", RATE_LIMITS.adminWrite.ip);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const { display_name, prize_amount, week_label, publish_at } = await req.json();

  if (!display_name || !prize_amount) {
    return NextResponse.json(
      { error: "Missing required fields: display_name, prize_amount" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  const { data: announcement, error } = await supabase
    .from("winner_announcements")
    .insert({
      display_name,
      prize_amount,
      week_label,
      publish_at: publish_at || new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(safeServerError("admin.winner_announcement_create_failed", error), { status: 500 });
  }

  return NextResponse.json({ success: true, announcement });
}
