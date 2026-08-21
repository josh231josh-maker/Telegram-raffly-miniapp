import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { RATE_LIMITS, rateLimitByIp, rateLimitResponse } from "@/lib/rate-limit";
import { safeServerError } from "@/lib/logger";

const MAX_TICKETS_PER_ENTRY = 10_000;
const MAX_INTERVAL_MINUTES = 60 * 24 * 30; // 1 month, generous upper bound

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ipCheck = await rateLimitByIp(req, "adminRead", RATE_LIMITS.adminRead.ip);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const supabase = getSupabaseAdmin();

  const { data: rules, error } = await supabase
    .from("auto_entry_rules")
    .select(
      "id, tickets_per_entry, interval_minutes, enabled, last_entered_at, created_at, users(id, telegram_id, username, first_name, ticket_balance)"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(safeServerError("admin.auto_entries_list_failed", error), { status: 500 });
  }

  return NextResponse.json({ rules: rules ?? [] });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ipCheck = await rateLimitByIp(req, "adminWrite", RATE_LIMITS.adminWrite.ip);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const { identifier, ticketsPerEntry, intervalMinutes } = await req.json();

  const trimmedIdentifier = typeof identifier === "string" ? identifier.trim().replace(/^@/, "") : "";
  if (!trimmedIdentifier) {
    return NextResponse.json({ error: "Enter a username or Telegram ID" }, { status: 400 });
  }
  if (!Number.isInteger(ticketsPerEntry) || ticketsPerEntry <= 0 || ticketsPerEntry > MAX_TICKETS_PER_ENTRY) {
    return NextResponse.json({ error: "Tickets per entry must be a positive whole number" }, { status: 400 });
  }
  if (!Number.isInteger(intervalMinutes) || intervalMinutes <= 0 || intervalMinutes > MAX_INTERVAL_MINUTES) {
    return NextResponse.json({ error: "Interval must be a positive whole number of minutes" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const asTelegramId = Number(trimmedIdentifier);
  const { data: user, error: userError } = await (Number.isInteger(asTelegramId) && String(asTelegramId) === trimmedIdentifier
    ? supabase.from("users").select("id").eq("telegram_id", asTelegramId).maybeSingle()
    : supabase.from("users").select("id").ilike("username", trimmedIdentifier).maybeSingle());

  if (userError) {
    return NextResponse.json(safeServerError("admin.auto_entries_user_lookup_failed", userError), { status: 500 });
  }
  if (!user) {
    return NextResponse.json({ error: "No user found with that username or Telegram ID" }, { status: 404 });
  }

  const { data: created, error } = await supabase
    .from("auto_entry_rules")
    .insert({ user_id: user.id, tickets_per_entry: ticketsPerEntry, interval_minutes: intervalMinutes })
    .select(
      "id, tickets_per_entry, interval_minutes, enabled, last_entered_at, created_at, users(id, telegram_id, username, first_name, ticket_balance)"
    )
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "This user already has an auto-entry rule -- edit or delete it instead of adding another." },
        { status: 409 }
      );
    }
    return NextResponse.json(safeServerError("admin.auto_entries_create_failed", error), { status: 500 });
  }

  return NextResponse.json({ rule: created });
}
