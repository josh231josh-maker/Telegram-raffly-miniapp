import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { processDueAutoEntries } from "@/lib/auto-entry";
import { timingSafeEqual } from "@/lib/timing-safe";

export const maxDuration = 30;

// Triggered by an external scheduler (QStash), not Vercel Cron -- Vercel's
// Hobby plan only runs native crons once a day, too coarse for per-rule
// intervals as short as an hour. A dedicated secret (distinct from
// CRON_SECRET) gates this so the scheduler config only ever needs this one
// value.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = process.env.AUTO_ENTRY_CRON_SECRET
    ? `Bearer ${process.env.AUTO_ENTRY_CRON_SECRET}`
    : undefined;
  if (!timingSafeEqual(authHeader, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const result = await processDueAutoEntries(supabase);
  return NextResponse.json(result);
}
