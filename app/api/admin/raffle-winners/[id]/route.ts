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
    //
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
      return NextResponse.json(safeServerError("admin.winner_approve_failed", error, { winnerId }), { status: 500 });
    }
    if (!updated) {
      return NextResponse.json({ error: "Winner is no longer pending" }, { status: 409 });
    }

    const { error: balanceError } = await supabase.rpc("increment_usdt_balance", {
      p_user_id: winner.user_id,
      p_delta: winner.prize_amount,
    });

    if (balanceError) {
      return NextResponse.json(safeServerError("admin.winner_approve_credit_failed", balanceError, { winnerId, userId: winner.user_id }), { status: 500 });
    }

    logger.warn("admin.winner_approved", { winnerId, userId: winner.user_id, prizeAmount: winner.prize_amount });

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
      return NextResponse.json(safeServerError("admin.winner_reject_failed", error, { winnerId }), { status: 500 });
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
    const { data: updated, error } = await supabase
      .from("raffle_winners")
      .update({ status: "revoked" })
      .eq("id", winnerId)
      .eq("status", "approved")
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json(safeServerError("admin.winner_revoke_failed", error, { winnerId }), { status: 500 });
    }
    if (!updated) {
      return NextResponse.json({ error: "Only an approved winner can be revoked" }, { status: 409 });
    }

    // Claw back the credit, floored at 0 (inside the RPC) — if the user
    // already withdrew some or all of it, that portion can't be reversed here.
    const { error: balanceError } = await supabase.rpc("increment_usdt_balance", {
      p_user_id: winner.user_id,
      p_delta: -winner.prize_amount,
    });

    if (balanceError) {
      return NextResponse.json(safeServerError("admin.winner_revoke_credit_failed", balanceError, { winnerId, userId: winner.user_id }), { status: 500 });
    }

    logger.warn("admin.winner_revoked", { winnerId, userId: winner.user_id, prizeAmount: winner.prize_amount });

    return NextResponse.json({
      success: true,
      message: "Winner revoked and balance credit reversed.",
    });
  }
}
