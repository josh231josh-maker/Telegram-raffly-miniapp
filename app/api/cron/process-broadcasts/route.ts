import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { processBroadcastBatch } from "@/lib/broadcast";

export const maxDuration = 60;

// Safety net only -- drains broadcasts an admin already started (status
// "sending") that were left mid-flight, e.g. the admin closed the dashboard
// tab before the last continuation call went out. Never promotes a "draft"
// broadcast on its own, so a broadcast is never sent without a human
// explicitly clicking Send first.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
    if (broadcast.button_type === "webapp" && !appUrl) {
      console.error(`[broadcast:${broadcast.id}] skipped -- webapp button but NEXT_PUBLIC_APP_URL is unset`);
      results.push({ broadcastId: broadcast.id, status: broadcast.status, sent: broadcast.sent_count, failed: broadcast.failed_count, skipped: true });
      continue;
    }
    results.push({ broadcastId: broadcast.id, ...(await processBroadcastBatch(supabase, broadcast, botToken, appUrl)) });
  }

  return NextResponse.json({ results });
}
