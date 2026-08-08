import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminUser = await verifyAdminAuth();
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { action } = await req.json();

  if (!["approve", "reject", "revoke"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { id: winnerId } = await params;

  const { data: winner, error: fetchError } = await supabase
    .from("raffle_winners")
    .select("id, user_id, prize_amount, status")
    .eq("id", winnerId)
    .single();

  if (fetchError || !winner) {
    return NextResponse.json({ error: "Winner not found" }, { status: 404 });
  }

  if (action === "approve") {
    // Approving credits the win straight into the user's in-app balance —
    // this isn't a real payout, just making their winnings spendable.
    // Actual money only leaves your hand later, when they withdraw. The
    // public winners list is never touched automatically here — that's a
    // separate, fully manual step in Manage Winners.
    const { data: user } = await supabase
      .from("users")
      .select("usdt_balance")
      .eq("id", winner.user_id)
      .single();

    // Conditioned on the current status so two concurrent requests (or a
    // double-click) can't both succeed and double-credit the same winner.
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

    const currentBalance = user?.usdt_balance || 0;
    const { error: balanceError } = await supabase
      .from("users")
      .update({ usdt_balance: currentBalance + winner.prize_amount })
      .eq("id", winner.user_id);

    if (balanceError) {
      return NextResponse.json({ error: balanceError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Approved and credited $${winner.prize_amount} to the user's balance.`,
    });
  }

  if (action === "reject") {
    const { data: updated, error } = await supabase
      .from("raffle_winners")
      .update({ status: "rejected" })
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
      message: "Winner rejected. User balance remains unchanged.",
    });
  }

  if (action === "revoke") {
    const { data: user } = await supabase
      .from("users")
      .select("usdt_balance")
      .eq("id", winner.user_id)
      .single();

    const { data: updated, error } = await supabase
      .from("raffle_winners")
      .update({ status: "revoked" })
      .eq("id", winnerId)
      .eq("status", "approved")
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!updated) {
      return NextResponse.json({ error: "Only an approved winner can be revoked" }, { status: 409 });
    }

    // Claw back the credit, floored at 0 — if the user already withdrew some
    // or all of it, that portion can't be reversed here.
    const currentBalance = user?.usdt_balance || 0;
    const newBalance = Math.max(0, currentBalance - winner.prize_amount);
    const { error: balanceError } = await supabase
      .from("users")
      .update({ usdt_balance: newBalance })
      .eq("id", winner.user_id);

    if (balanceError) {
      return NextResponse.json({ error: balanceError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Winner revoked and balance credit reversed.",
    });
  }
}
