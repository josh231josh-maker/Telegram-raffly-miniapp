import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { RATE_LIMITS, rateLimitByIp, rateLimitResponse } from "@/lib/rate-limit";
import { logger, safeServerError } from "@/lib/logger";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminUser = await verifyAdminAuth();
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ipCheck = await rateLimitByIp(req, "adminWrite", RATE_LIMITS.adminWrite.ip);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

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
      return NextResponse.json(safeServerError("admin.withdrawal_approve_failed", error, { withdrawalId }), { status: 500 });
    }
    if (!updated) {
      return NextResponse.json({ error: "Withdrawal is no longer pending" }, { status: 409 });
    }

    logger.warn("admin.withdrawal_approved", { withdrawalId, userId: withdrawal.user_id, amount: withdrawal.amount });

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
      return NextResponse.json(safeServerError("admin.withdrawal_reject_failed", error, { withdrawalId }), { status: 500 });
    }
    if (!updated) {
      return NextResponse.json({ error: "Withdrawal can no longer be rejected" }, { status: 409 });
    }

    // The requested amount was reserved (zeroed out of the user's balance)
    // when this withdrawal was created -- since it isn't being paid, credit
    // it back rather than letting it disappear.
    const { error: balanceError } = await supabase.rpc("increment_usdt_balance", {
      p_user_id: withdrawal.user_id,
      p_delta: withdrawal.amount,
    });

    if (balanceError) {
      return NextResponse.json(safeServerError("admin.withdrawal_reject_credit_failed", balanceError, { withdrawalId, userId: withdrawal.user_id }), { status: 500 });
    }

    logger.warn("admin.withdrawal_rejected", { withdrawalId, userId: withdrawal.user_id, amount: withdrawal.amount });

    return NextResponse.json({
      success: true,
      message: "Withdrawal rejected. Balance credited back to the user.",
    });
  }

  if (action === "mark-paid") {
    if (!txHash) {
      return NextResponse.json({ error: "TX hash required" }, { status: 400 });
    }

    const { data: updated, error: updateError } = await supabase
      .from("withdrawals")
      .update({ status: "paid", processed_at: new Date().toISOString(), tx_hash: txHash })
      .eq("id", withdrawalId)
      .eq("status", "approved")
      .select()
      .maybeSingle();

    if (updateError) {
      return NextResponse.json(safeServerError("admin.withdrawal_mark_paid_failed", updateError, { withdrawalId }), { status: 500 });
    }
    if (!updated) {
      return NextResponse.json(
        { error: "Withdrawal must be approved before marking paid" },
        { status: 409 }
      );
    }

    // usdt_balance was already reserved (zeroed) when this withdrawal was
    // requested (see /api/withdraw), so paying it out doesn't touch the
    // balance again -- doing so would also wrongly claw back any unrelated
    // balance the user earned while this withdrawal sat pending/approved.
    logger.warn("admin.withdrawal_paid", { withdrawalId, userId: withdrawal.user_id, amount: withdrawal.amount, txHash });

    return NextResponse.json({
      success: true,
      message: `Withdrawal marked as paid.`,
    });
  }
}
