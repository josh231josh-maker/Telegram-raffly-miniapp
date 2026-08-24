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

// Hard cap on rows scanned per request, purely to bound the visible contact
// table (the header totals come from bot_messages_stats() below and are
// exact regardless of this cap). Recent activity always sorts first, so a
// cap here only ever drops the oldest, least useful rows for a given range.
// Kept small since every fetched row becomes a rendered table row with no
// pagination/virtualization, plus an entry in the follow-up photo lookup's
// IN (...) list.
const MAX_ROWS = 100;

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
  const rangeStart = hours !== null ? new Date(Date.now() - hours * 60 * 60 * 1000).toISOString() : null;

  let query = supabase
    .from("bot_messages")
    .select("telegram_id, username, first_name, message_text, created_at")
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);

  if (rangeStart !== null) {
    query = query.gte("created_at", rangeStart);
  }

  // The row fetch above is capped (both by MAX_ROWS and, underneath that, by
  // Supabase's own API row limit) since it only needs to feed the visible
  // contact list. The header counts must stay exact regardless of how many
  // rows that cap drops, so they come from a separate aggregate query
  // (COUNT(*) / COUNT(DISTINCT telegram_id)) that never materializes rows.
  const [{ data: rows, error }, statsResult] = await Promise.all([
    query,
    supabase.rpc("bot_messages_stats", { range_start: rangeStart }).single(),
  ]);
  const { data: stats, error: statsError } = statsResult as {
    data: { total_messages: number; total_users: number } | null;
    error: { message: string } | null;
  };

  if (error) {
    return NextResponse.json(safeServerError("admin.bot_messages_list_failed", error), { status: 500 });
  }
  if (statsError) {
    return NextResponse.json(safeServerError("admin.bot_messages_stats_failed", statsError), { status: 500 });
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

  // Not every bot contact is a Mini App user (someone can message the bot
  // without ever opening the app), so this is a best-effort lookup, not a
  // join the query depends on -- a contact with no matching row here just
  // renders with no photo, the same as one who registered but never set one.
  const telegramIds = contacts.map((c) => c.telegramId);
  const { data: matchingUsers } = telegramIds.length
    ? await supabase.from("users").select("telegram_id, photo_url").in("telegram_id", telegramIds)
    : { data: [] as { telegram_id: number; photo_url: string | null }[] };
  const photoByTelegramId = new Map((matchingUsers ?? []).map((u) => [u.telegram_id, u.photo_url]));
  const contactsWithPhotos = contacts.map((c) => ({
    ...c,
    photoUrl: photoByTelegramId.get(c.telegramId) ?? null,
  }));

  return NextResponse.json({
    contacts: contactsWithPhotos,
    totalUsers: stats?.total_users ?? contacts.length,
    totalMessages: stats?.total_messages ?? rows?.length ?? 0,
    // Now specifically means "the contact list below isn't everyone" --
    // totalUsers/totalMessages above are always exact, from bot_messages_stats.
    truncated: contacts.length < (stats?.total_users ?? contacts.length),
  });
}
