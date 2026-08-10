import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { processBroadcastBatch } from "@/lib/broadcast";
import type { ButtonInput } from "@/lib/telegram-bot";
import { timingSafeEqual } from "@/lib/timing-safe";
import { logger } from "@/lib/logger";

export const maxDuration = 60;

// Safety net only -- drains broadcasts an admin already started (status
// "sending") that were left mid-flight, e.g. the admin closed the dashboard
// tab before the last continuation call went out. Never promotes a "draft"
// broadcast on its own, so a broadcast is never sent without a human
// explicitly clicking Send first.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : undefined;
  if (!timingSafeEqual(authHeader, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: "Server is missing TELEGRAM_BOT_TOKEN" }, { status: 500 });
  }
  // Only a "Mini App" button actually needs this -- a broadcast using a
  // plain link button or no button at all shouldn't be blocked by it being unset.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const supabase = getSupabaseAdmin();
  const { data: stuck } = await supabase.from("broadcasts").select("*").eq("status", "sending");

  const results = [];
  for (const broadcast of stuck ?? []) {
    const buttons = (broadcast.buttons ?? []) as ButtonInput[];
    if (buttons.some((b) => b.type === "webapp") && !appUrl) {
      logger.error("broadcast.skipped_missing_app_url", { broadcastId: broadcast.id });
      results.push({ broadcastId: broadcast.id, status: broadcast.status, sent: broadcast.sent_count, failed: broadcast.failed_count, skipped: true });
      continue;
    }
    try {
      const result = await processBroadcastBatch(supabase, broadcast, botToken, appUrl);
      results.push({ broadcastId: broadcast.id, ...result });
    } catch (err) {
      logger.error("broadcast.batch_failed", { broadcastId: broadcast.id, error: err instanceof Error ? err.message : String(err) });
      results.push({ broadcastId: broadcast.id, status: broadcast.status, sent: broadcast.sent_count, failed: broadcast.failed_count, error: true });
    }
  }

  return NextResponse.json({ results });
}
