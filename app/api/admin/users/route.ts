import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

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

  const params = req.nextUrl.searchParams;
  const search = params.get("search")?.trim() ?? "";
  const passFilter = params.get("passFilter") ?? "all";
  const sortByParam = params.get("sortBy") ?? "created_at";
  const sortBy: SortColumn = (SORTABLE_COLUMNS as readonly string[]).includes(sortByParam)
    ? (sortByParam as SortColumn)
    : "created_at";
  const ascending = params.get("sortDir") === "asc";

  const supabase = getSupabaseAdmin();

  let query = supabase.from("users").select("*", { count: "exact" });

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const [{ count: totalCount }, { data: referredByRows }] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase.from("users").select("referred_by").not("referred_by", "is", null),
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
