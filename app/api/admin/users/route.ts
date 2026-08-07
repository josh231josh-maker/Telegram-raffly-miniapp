import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const search = req.nextUrl.searchParams.get("search")?.trim() ?? "";
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("users")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (search) {
    const asTelegramId = Number(search);
    if (!Number.isNaN(asTelegramId)) {
      query = query.eq("telegram_id", asTelegramId);
    } else {
      query = query.ilike("username", `%${search}%`);
    }
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

  return NextResponse.json({
    users: usersWithReferrals,
    resultCount: count ?? usersWithReferrals.length,
    totalCount: totalCount ?? 0,
  });
}
