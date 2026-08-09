import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { processBroadcastBatch } from "@/lib/broadcast";

// Sending a large list can take a while at Telegram's rate limit -- give
// this route more headroom than the default so a batch isn't cut off mid-send.
export const maxDuration = 60;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminUser = await verifyAdminAuth();
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: broadcast, error } = await supabase.from("broadcasts").select("*").eq("id", id).single();
  if (error || !broadcast) {
    return NextResponse.json({ error: "Broadcast not found" }, { status: 404 });
  }

  if (broadcast.status === "canceled") {
    return NextResponse.json({ error: "This broadcast was canceled" }, { status: 409 });
  }

  if (broadcast.status === "completed") {
    // Idempotent no-op rather than an error -- calling send again after
    // completion (e.g. a stray retry) shouldn't look like a failure.
    return NextResponse.json({ status: "completed", sent: broadcast.sent_count, failed: broadcast.failed_count, remaining: 0 });
  }

  if (broadcast.status === "draft") {
    // Best-effort guarded transition -- if it's already moved on (a
    // concurrent send request got here first), we just proceed to process
    // a batch below regardless, since claim_broadcast_recipients is what
    // actually prevents any recipient from being sent to twice.
    await supabase
      .from("broadcasts")
      .update({ status: "sending", started_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "draft");
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: "Server is missing TELEGRAM_BOT_TOKEN" }, { status: 500 });
  }

  // Only a "Mini App" button actually needs the app URL -- a plain link
  // button or no button at all shouldn't be blocked by it being unset.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (broadcast.button_type === "webapp" && !appUrl) {
    return NextResponse.json(
      {
        error:
          "This broadcast's button opens the Mini App, but NEXT_PUBLIC_APP_URL isn't set on the server. Set it in Vercel's project settings, or edit this broadcast to use a plain link button instead.",
      },
      { status: 500 }
    );
  }

  const result = await processBroadcastBatch(supabase, broadcast, botToken, appUrl);
  return NextResponse.json(result);
}
