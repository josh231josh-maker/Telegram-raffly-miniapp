import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { RATE_LIMITS, rateLimitByIp, rateLimitResponse } from "@/lib/rate-limit";
import { safeServerError } from "@/lib/logger";

const RANGE_HOURS: Record<string, number | null> = {
  "24h": 24,
  "7d": 7 * 24,
  "30d": 30 * 24,
  all: null,
};

// Hard cap on rows scanned per request -- this table only ever grows, and
// without a limit a heavily-messaged "all time" query could pull an
// unbounded number of rows into the function just to group them in JS.
// Recent activity (the actual point of this view) always sorts first, so a
// cap here only ever drops the oldest, least useful rows for a given range.
const MAX_ROWS = 5000;

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ipCheck = await rateLimitByIp(req, "adminRead", RATE_LIMITS.adminRead.ip);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const range = req.nextUrl.searchParams.get("range") ?? "7d";
  const hours = RANGE_HOURS[range];
  if (hours === undefined) {
    return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("bot_messages")
    .select("telegram_id, username, first_name, message_text, created_at")
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);

  if (hours !== null) {
    query = query.gte("created_at", new Date(Date.now() - hours * 60 * 60 * 1000).toISOString());
  }

  const { data: rows, error } = await query;

  if (error) {
    return NextResponse.json(safeServerError("admin.bot_messages_list_failed", error), { status: 500 });
  }

  // Small-scale aggregation in JS (same convention as tracking-links'
  // acquisition counts) -- rows already arrive newest-first, so the first
  // occurrence of each telegram_id is that contact's most recent event, and
  // the first occurrence carrying actual text is their most recent typed
  // message (some events, like payment notifications, have no message.text
  // at all -- skipping those for lastMessageText avoids showing "—" for a
  // contact who did type something, just not in their very last event).
  type Contact = {
    telegramId: number;
    username: string | null;
    firstName: string | null;
    lastMessageAt: string;
    lastMessageText: string | null;
    messageCount: number;
  };
  const byId = new Map<number, Contact>();
  for (const row of rows ?? []) {
    const existing = byId.get(row.telegram_id);
    if (existing) {
      existing.messageCount += 1;
      if (existing.lastMessageText === null && row.message_text) {
        existing.lastMessageText = row.message_text;
      }
    } else {
      byId.set(row.telegram_id, {
        telegramId: row.telegram_id,
        username: row.username,
        firstName: row.first_name,
        lastMessageAt: row.created_at,
        lastMessageText: row.message_text ?? null,
        messageCount: 1,
      });
    }
  }

  const contacts = Array.from(byId.values()).sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  );

  return NextResponse.json({
    contacts,
    totalUsers: contacts.length,
    totalMessages: rows?.length ?? 0,
    truncated: (rows?.length ?? 0) >= MAX_ROWS,
  });
}
