import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  // Removes the user's dependent rows (raffle entries, transactions, withdrawals,
  // etc.) and clears any referral links pointing at them before deleting the
  // account, since the foreign keys are NO ACTION rather than CASCADE.
  const { error } = await supabase.rpc("admin_delete_user", { p_user_id: id });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
