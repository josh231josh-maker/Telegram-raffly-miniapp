import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { RAFFLY_PASS_DAILY_TICKETS } from "@/lib/raffly-pass";
import { timingSafeEqual } from "@/lib/timing-safe";
import { logger, safeServerError } from "@/lib/logger";

// Triggered daily by Vercel Cron (see vercel.json). Vercel automatically
// sends `Authorization: Bearer $CRON_SECRET` on cron-triggered requests.
// Credits every currently-active Raffly Pass holder in one atomic DB
// statement (credit_daily_pass_tickets) -- see that function's own comment
// for why a re-run of this route on the same day is safe.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : undefined;
  if (!timingSafeEqual(authHeader, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const { data: creditedCount, error } = await supabase.rpc("credit_daily_pass_tickets", {
    p_today: today,
    p_tickets: RAFFLY_PASS_DAILY_TICKETS,
  });

  if (error) {
    return NextResponse.json(
      safeServerError("pass.daily_credit_failed", error, { today }),
      { status: 500 }
    );
  }

  logger.info("pass.daily_credit_completed", { today, creditedCount });
  return NextResponse.json({ today, creditedCount });
}
