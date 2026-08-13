import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { RATE_LIMITS, rateLimitByIp, rateLimitResponse } from "@/lib/rate-limit";
import { logger, safeServerError } from "@/lib/logger";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ipCheck = await rateLimitByIp(req, "adminWrite", RATE_LIMITS.adminWrite.ip);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const { id } = await params;
  const { ticketDelta, usdtDelta } = await req.json();

  // `Number("Infinity") || 0` doesn't catch Infinity (it's truthy), and the
  // Supabase client JSON-serializes it as `null` on the way to the RPC --
  // Postgres's `greatest(0, balance + NULL)` then silently resets the
  // balance to 0 instead of erroring. Reject any non-finite delta outright
  // rather than let it reach the RPC. Omitted/blank fields still mean "no
  // change to this balance", same as before.
  const parseDelta = (raw: unknown): number | null => {
    if (raw === undefined || raw === null || raw === "") return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  const ticketAdjust = parseDelta(ticketDelta);
  const usdtAdjust = parseDelta(usdtDelta);

  if (ticketAdjust === null || usdtAdjust === null) {
    return NextResponse.json({ error: "Adjustment must be a finite number" }, { status: 400 });
  }
  if (!Number.isInteger(ticketAdjust)) {
    return NextResponse.json({ error: "ticketDelta must be a whole number" }, { status: 400 });
  }

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
      return NextResponse.json(safeServerError("admin.adjust_ticket_failed", error, { userId: id }), { status: 500 });
    }
  }

  if (usdtAdjust !== 0) {
    const { error } = await supabase.rpc("increment_usdt_balance", {
      p_user_id: id,
      p_delta: usdtAdjust,
    });
    if (error) {
      return NextResponse.json(safeServerError("admin.adjust_usdt_failed", error, { userId: id }), { status: 500 });
    }
  }

  logger.warn("admin.balance_adjusted", { userId: id, ticketAdjust, usdtAdjust });

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
