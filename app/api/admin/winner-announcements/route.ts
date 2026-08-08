import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const adminUser = await verifyAdminAuth();
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const { data: announcements, error } = await supabase
    .from("winner_announcements")
    .select("id, display_name, prize_amount, week_label, publish_at, created_at, raffle_winner_id")
    .order("publish_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ announcements });
}

export async function POST(req: NextRequest) {
  const adminUser = await verifyAdminAuth();
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { display_name, prize_amount, week_label, publish_at } = await req.json();

  if (!display_name || !prize_amount || !week_label) {
    return NextResponse.json(
      { error: "Missing required fields: display_name, prize_amount, week_label" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  const { data: announcement, error } = await supabase
    .from("winner_announcements")
    .insert({
      display_name,
      prize_amount,
      week_label,
      publish_at: publish_at || new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, announcement });
}
