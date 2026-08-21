import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { RATE_LIMITS, rateLimitByIp, rateLimitResponse } from "@/lib/rate-limit";
import { safeServerError } from "@/lib/logger";

const MAX_TICKETS_PER_ENTRY = 10_000;
const MAX_INTERVAL_MINUTES = 60 * 24 * 30;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ipCheck = await rateLimitByIp(req, "adminWrite", RATE_LIMITS.adminWrite.ip);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const { id } = await params;
  const { enabled, ticketsPerEntry, intervalMinutes } = await req.json();

  const updates: Record<string, number | boolean> = {};
  if (typeof enabled === "boolean") updates.enabled = enabled;
  if (ticketsPerEntry !== undefined) {
    if (!Number.isInteger(ticketsPerEntry) || ticketsPerEntry <= 0 || ticketsPerEntry > MAX_TICKETS_PER_ENTRY) {
      return NextResponse.json({ error: "Tickets per entry must be a positive whole number" }, { status: 400 });
    }
    updates.tickets_per_entry = ticketsPerEntry;
  }
  if (intervalMinutes !== undefined) {
    if (!Number.isInteger(intervalMinutes) || intervalMinutes <= 0 || intervalMinutes > MAX_INTERVAL_MINUTES) {
      return NextResponse.json({ error: "Interval must be a positive whole number of minutes" }, { status: 400 });
    }
    updates.interval_minutes = intervalMinutes;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: updated, error } = await supabase
    .from("auto_entry_rules")
    .update(updates)
    .eq("id", id)
    .select(
      "id, tickets_per_entry, interval_minutes, enabled, last_entered_at, created_at, users(id, telegram_id, username, first_name, ticket_balance)"
    )
    .maybeSingle();

  if (error) {
    return NextResponse.json(safeServerError("admin.auto_entries_update_failed", error, { ruleId: id }), { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }

  return NextResponse.json({ rule: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ipCheck = await rateLimitByIp(req, "adminWrite", RATE_LIMITS.adminWrite.ip);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from("auto_entry_rules").delete().eq("id", id);

  if (error) {
    return NextResponse.json(safeServerError("admin.auto_entries_delete_failed", error, { ruleId: id }), { status: 500 });
  }

  return NextResponse.json({ success: true });
}
