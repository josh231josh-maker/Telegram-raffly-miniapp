import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminUser = await verifyAdminAuth();
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { action, txHash } = await req.json();

  if (!["approve", "reject", "mark-paid"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { id: winnerId } = await params;

  const { data: winner, error: fetchError } = await supabase
    .from("raffle_winners")
    .select("id, user_id, prize_amount, status, week_label")
    .eq("id", winnerId)
    .single();

  if (fetchError || !winner) {
    return NextResponse.json({ error: "Winner not found" }, { status: 404 });
  }

  if (action === "approve") {
    // Conditioned on the current status so two concurrent requests (or a
    // double-click) can't both succeed and double-process the same winner.
    const { data: updated, error } = await supabase
      .from("raffle_winners")
      .update({ status: "approved" })
      .eq("id", winnerId)
      .eq("status", "pending")
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!updated) {
      return NextResponse.json({ error: "Winner is no longer pending" }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      message: "Winner approved. Next: mark as paid when funds are sent.",
    });
  }

  if (action === "reject") {
    const { data: updated, error } = await supabase
      .from("raffle_winners")
      .update({ status: "rejected" })
      .eq("id", winnerId)
      .in("status", ["pending", "approved"])
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!updated) {
      return NextResponse.json({ error: "Winner can no longer be rejected" }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      message: "Winner rejected. User balance remains unchanged.",
    });
  }

  if (action === "mark-paid") {
    if (!txHash) {
      return NextResponse.json({ error: "TX hash required" }, { status: 400 });
    }

    const { data: user } = await supabase
      .from("users")
      .select("usdt_balance, first_name, username")
      .eq("id", winner.user_id)
      .single();

    const currentBalance = user?.usdt_balance || 0;

    const { data: updated, error: updateError } = await supabase
      .from("raffle_winners")
      .update({ status: "paid", paid_at: new Date().toISOString(), tx_hash: txHash })
      .eq("id", winnerId)
      .eq("status", "approved")
      .select()
      .maybeSingle();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    if (!updated) {
      return NextResponse.json({ error: "Winner must be approved before marking paid" }, { status: 409 });
    }

    const { error: balanceError } = await supabase
      .from("users")
      .update({ usdt_balance: currentBalance + winner.prize_amount })
      .eq("id", winner.user_id);

    if (balanceError) {
      return NextResponse.json({ error: balanceError.message }, { status: 500 });
    }

    const { error: announceError } = await supabase.from("winner_announcements").insert({
      raffle_winner_id: winnerId,
      display_name: user?.first_name || user?.username || "Winner",
      prize_amount: winner.prize_amount,
      week_label: winner.week_label,
      publish_at: new Date().toISOString(),
    });

    if (announceError) {
      return NextResponse.json({ error: announceError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Marked as paid and credited $${winner.prize_amount} to user balance.`,
    });
  }
}
