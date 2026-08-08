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
    .select("id")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (ticketAdjust !== 0) {
    // Floored at 0 inside the RPC, same as every other ticket-balance mutation.
    const { error } = await supabase.rpc("increment_ticket_balance", {
      p_user_id: id,
      p_delta: ticketAdjust,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (usdtAdjust !== 0) {
    const { error } = await supabase.rpc("increment_usdt_balance", {
      p_user_id: id,
      p_delta: usdtAdjust,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const { data: updated, error: refetchError } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .single();

  if (refetchError || !updated) {
    return NextResponse.json({ error: "Failed to load updated user" }, { status: 500 });
  }

  return NextResponse.json({ user: updated });
}
