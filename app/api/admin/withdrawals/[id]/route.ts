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
  const { id: withdrawalId } = await params;

  const { data: withdrawal, error: fetchError } = await supabase
    .from("withdrawals")
    .select("id, user_id, amount, status")
    .eq("id", withdrawalId)
    .single();

  if (fetchError || !withdrawal) {
    return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
  }

  if (action === "approve") {
    // Conditioned on the current status so two concurrent requests (or a
    // double-click) can't both succeed and double-process the same withdrawal.
    const { data: updated, error } = await supabase
      .from("withdrawals")
      .update({ status: "approved" })
      .eq("id", withdrawalId)
      .eq("status", "pending")
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!updated) {
      return NextResponse.json({ error: "Withdrawal is no longer pending" }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      message: "Withdrawal approved. Next: mark as paid when funds are sent.",
    });
  }

  if (action === "reject") {
    const { data: updated, error } = await supabase
      .from("withdrawals")
      .update({ status: "rejected" })
      .eq("id", withdrawalId)
      .in("status", ["pending", "approved"])
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!updated) {
      return NextResponse.json({ error: "Withdrawal can no longer be rejected" }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      message: "Withdrawal rejected. User balance remains unchanged.",
    });
  }

  if (action === "mark-paid") {
    if (!txHash) {
      return NextResponse.json({ error: "TX hash required" }, { status: 400 });
    }

    const { data: user } = await supabase
      .from("users")
      .select("usdt_balance")
      .eq("id", withdrawal.user_id)
      .single();

    // Subtract only the withdrawn amount rather than zeroing outright — the
    // user's balance may have grown from unrelated sources (e.g. a raffle
    // win credited) while this withdrawal sat pending/approved.
    const currentBalance = user?.usdt_balance || 0;
    const newBalance = Math.max(0, currentBalance - withdrawal.amount);

    const { data: updated, error: updateError } = await supabase
      .from("withdrawals")
      .update({ status: "paid", processed_at: new Date().toISOString(), tx_hash: txHash })
      .eq("id", withdrawalId)
      .eq("status", "approved")
      .select()
      .maybeSingle();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    if (!updated) {
      return NextResponse.json(
        { error: "Withdrawal must be approved before marking paid" },
        { status: 409 }
      );
    }

    const { error: balanceError } = await supabase
      .from("users")
      .update({ usdt_balance: newBalance })
      .eq("id", withdrawal.user_id);

    if (balanceError) {
      return NextResponse.json({ error: balanceError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Withdrawal marked as paid.`,
    });
  }
}
