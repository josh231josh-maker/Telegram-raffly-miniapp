import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { RATE_LIMITS, rateLimitByIp, rateLimitResponse } from "@/lib/rate-limit";
import { safeServerError } from "@/lib/logger";

const SORTABLE_COLUMNS = [
  "created_at",
  "ticket_balance",
  "usdt_balance",
  "streak_count",
  "telegram_id",
  "referral_count",
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
      "id, telegram_id, username, first_name, photo_url, ticket_balance, usdt_balance, streak_count, raffly_pass_expires_at, created_at",
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

  // referral_count isn't a real column -- sort by created_at here and re-sort in JS below.
  if (sortBy !== "referral_count") {
    query = query.order(sortBy, { ascending });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data: users, error, count } = await query.limit(200);

  if (error) {
    return NextResponse.json(safeServerError("admin.users_list_failed", error), { status: 500 });
  }

  // Referral counts only ever need to cover the page of users actually
  // being displayed -- scoping this to their ids (instead of scanning
  // every referred_by value in the whole table) gives identical counts for
  // this page while the query's cost stops growing with total user count.
  const pageUserIds = (users ?? []).map((u) => u.id);
  const [{ count: totalCount }, { data: referredByRows }] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }),
    pageUserIds.length > 0
      ? supabase.from("users").select("referred_by").in("referred_by", pageUserIds)
      : Promise.resolve({ data: [] as { referred_by: string | null }[] }),
  ]);

  const referralCounts = new Map<string, number>();
  for (const row of referredByRows ?? []) {
    if (row.referred_by) {
      referralCounts.set(row.referred_by, (referralCounts.get(row.referred_by) ?? 0) + 1);
    }
  }

  const usersWithReferrals = (users ?? []).map((u) => ({
    ...u,
    referral_count: referralCounts.get(u.id) ?? 0,
  }));

  if (sortBy === "referral_count") {
    usersWithReferrals.sort((a, b) =>
      ascending ? a.referral_count - b.referral_count : b.referral_count - a.referral_count
    );
  }

  return NextResponse.json({
    users: usersWithReferrals,
    resultCount: count ?? usersWithReferrals.length,
    totalCount: totalCount ?? 0,
  });
}
