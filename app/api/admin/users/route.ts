import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentWeekEnd } from "@/lib/raffle-week";
import { RATE_LIMITS, rateLimitByIp, rateLimitResponse } from "@/lib/rate-limit";
import { safeServerError } from "@/lib/logger";

const SORTABLE_COLUMNS = [
  "created_at",
  "ticket_balance",
  "usdt_balance",
  "streak_count",
  "telegram_id",
  "referral_count",
  "entries_this_draw",
] as const;
type SortColumn = (typeof SORTABLE_COLUMNS)[number];

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ipCheck = await rateLimitByIp(req, "adminRead", RATE_LIMITS.adminRead.ip);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const params = req.nextUrl.searchParams;
  const search = params.get("search")?.trim() ?? "";
  const passFilter = params.get("passFilter") ?? "all";
  const sortByParam = params.get("sortBy") ?? "created_at";
  const sortBy: SortColumn = (SORTABLE_COLUMNS as readonly string[]).includes(sortByParam)
    ? (sortByParam as SortColumn)
    : "created_at";
  const ascending = params.get("sortDir") === "asc";

  const supabase = getSupabaseAdmin();

  // Only the columns the admin table actually renders -- select("*") was
  // pulling every column (including long fields like ton_wallet_address)
  // for up to 200 rows on every dashboard load.
  let query = supabase
    .from("users")
    .select(
      "id, telegram_id, username, first_name, photo_url, country_code, ticket_balance, usdt_balance, streak_count, raffly_pass_expires_at, created_at",
      { count: "exact" }
    );

  if (search) {
    const asTelegramId = Number(search);
    if (!Number.isNaN(asTelegramId)) {
      query = query.eq("telegram_id", asTelegramId);
    } else {
      query = query.ilike("username", `%${search}%`);
    }
  }

  const nowIso = new Date().toISOString();
  if (passFilter === "active") {
    query = query.gt("raffly_pass_expires_at", nowIso);
  } else if (passFilter === "inactive") {
    query = query.or(`raffly_pass_expires_at.is.null,raffly_pass_expires_at.lte.${nowIso}`);
  }

  // Neither referral_count nor entries_this_draw is a real column -- sort by
  // created_at here and re-sort in JS below.
  const isComputedColumn = sortBy === "referral_count" || sortBy === "entries_this_draw";
  if (!isComputedColumn) {
    query = query.order(sortBy, { ascending });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data: users, error, count } = await query.limit(200);

  if (error) {
    return NextResponse.json(safeServerError("admin.users_list_failed", error), { status: 500 });
  }

  // Referral counts and this-draw entries only ever need to cover the page
  // of users actually being displayed -- scoping both to their ids (instead
  // of scanning every referred_by value or every raffle_entries row) gives
  // identical results for this page while the cost stops growing with total
  // user or entry count.
  const pageUserIds = (users ?? []).map((u) => u.id);

  // The current draw's raffle row doesn't exist until its first entry
  // (getOrCreateCurrentRaffle), so "no raffle yet" is a normal state here,
  // not an error -- it just means everyone's shown as 0 entered so far.
  const weekEndIso = getCurrentWeekEnd().toISOString();

  const [{ count: totalCount }, { data: referredByRows }, { data: currentRaffle }] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }),
    pageUserIds.length > 0
      ? supabase.from("users").select("referred_by").in("referred_by", pageUserIds)
      : Promise.resolve({ data: [] as { referred_by: string | null }[] }),
    supabase.from("raffles").select("id").eq("week_end", weekEndIso).maybeSingle(),
  ]);

  const { data: entryRows } =
    currentRaffle && pageUserIds.length > 0
      ? await supabase
          .from("raffle_entries")
          .select("user_id, tickets_used")
          .eq("raffle_id", currentRaffle.id)
          .in("user_id", pageUserIds)
      : { data: [] as { user_id: string; tickets_used: number }[] };

  const referralCounts = new Map<string, number>();
  for (const row of referredByRows ?? []) {
    if (row.referred_by) {
      referralCounts.set(row.referred_by, (referralCounts.get(row.referred_by) ?? 0) + 1);
    }
  }

  const drawEntryCounts = new Map<string, number>();
  for (const row of entryRows ?? []) {
    drawEntryCounts.set(row.user_id, (drawEntryCounts.get(row.user_id) ?? 0) + row.tickets_used);
  }

  const usersWithReferrals = (users ?? []).map((u) => ({
    ...u,
    referral_count: referralCounts.get(u.id) ?? 0,
    entries_this_draw: drawEntryCounts.get(u.id) ?? 0,
  }));

  if (sortBy === "referral_count" || sortBy === "entries_this_draw") {
    const key = sortBy;
    usersWithReferrals.sort((a, b) => (ascending ? a[key] - b[key] : b[key] - a[key]));
  }

  return NextResponse.json({
    users: usersWithReferrals,
    resultCount: count ?? usersWithReferrals.length,
    totalCount: totalCount ?? 0,
  });
}
