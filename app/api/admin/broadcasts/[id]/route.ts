import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { RATE_LIMITS, rateLimitByIp, rateLimitResponse } from "@/lib/rate-limit";
import { safeServerError } from "@/lib/logger";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminUser = await verifyAdminAuth();
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ipCheck = await rateLimitByIp(req, "adminRead", RATE_LIMITS.adminRead.ip);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: broadcast, error } = await supabase.from("broadcasts").select("*").eq("id", id).single();
  if (error || !broadcast) {
    return NextResponse.json({ error: "Broadcast not found" }, { status: 404 });
  }

  const { data: failures } = await supabase
    .from("broadcast_recipients")
    .select("id, telegram_id, error, users(username, first_name)")
    .eq("broadcast_id", id)
    .eq("status", "failed")
    .order("id")
    .limit(100);

  return NextResponse.json({ broadcast, failures: failures ?? [] });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminUser = await verifyAdminAuth();
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ipCheck = await rateLimitByIp(req, "adminWrite", RATE_LIMITS.adminWrite.ip);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  // Conditioned on status so a broadcast that already finished (or already
  // canceled) can't be "canceled" out from under a concurrent send.
  const { data: updated, error } = await supabase
    .from("broadcasts")
    .update({ status: "canceled" })
    .eq("id", id)
    .in("status", ["draft", "queued", "sending"])
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json(safeServerError("admin.broadcast_cancel_failed", error, { broadcastId: id }), { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: "Broadcast already completed or canceled" }, { status: 409 });
  }

  return NextResponse.json({ success: true, broadcast: updated });
}
