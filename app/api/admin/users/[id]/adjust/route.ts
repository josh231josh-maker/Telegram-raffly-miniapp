import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { ticketDelta, usdtDelta } = await req.json();

  const ticketAdjust = Number(ticketDelta) || 0;
  const usdtAdjust = Number(usdtDelta) || 0;

  if (ticketAdjust === 0 && usdtAdjust === 0) {
    return NextResponse.json({ error: "No adjustment provided" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: existing, error: fetchError } = await supabase
    .from("users")
    .select("ticket_balance, usdt_balance")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const newTicketBalance = Math.max(0, existing.ticket_balance + ticketAdjust);
  const newUsdtBalance = Math.max(0, Number(existing.usdt_balance) + usdtAdjust);

  const { data: updated, error } = await supabase
    .from("users")
    .update({ ticket_balance: newTicketBalance, usdt_balance: newUsdtBalance })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ user: updated });
}
