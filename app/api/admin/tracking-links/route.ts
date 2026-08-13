import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { RATE_LIMITS, rateLimitByIp, rateLimitResponse } from "@/lib/rate-limit";
import { safeServerError } from "@/lib/logger";

const MAX_LABEL_LENGTH = 80;
const CODE_GEN_ATTEMPTS = 5;

// Always starts with a letter so it can never parse as a number -- /api/auth
// tells a tracking-link code apart from a referral's raw telegram_id
// (always numeric) purely by whether Number(startParam) is NaN.
function generateCode(): string {
  return "c" + crypto.randomBytes(5).toString("hex");
}

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ipCheck = await rateLimitByIp(req, "adminRead", RATE_LIMITS.adminRead.ip);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const supabase = getSupabaseAdmin();

  const { data: links, error } = await supabase
    .from("tracking_links")
    .select("id, code, label, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(safeServerError("admin.tracking_links_list_failed", error), { status: 500 });
  }

  // Small table, small user table -- counting in JS (like referral_count
  // elsewhere in the admin dashboard) instead of standing up an RPC just for
  // a group-by.
  const { data: acquisitions, error: countError } = await supabase
    .from("users")
    .select("acquisition_link_code")
    .not("acquisition_link_code", "is", null);

  if (countError) {
    return NextResponse.json(safeServerError("admin.tracking_links_count_failed", countError), { status: 500 });
  }

  const counts = new Map<string, number>();
  for (const row of acquisitions ?? []) {
    if (row.acquisition_link_code) {
      counts.set(row.acquisition_link_code, (counts.get(row.acquisition_link_code) ?? 0) + 1);
    }
  }

  return NextResponse.json({
    links: (links ?? []).map((link) => ({ ...link, userCount: counts.get(link.code) ?? 0 })),
  });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ipCheck = await rateLimitByIp(req, "adminWrite", RATE_LIMITS.adminWrite.ip);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const { label } = await req.json();
  const trimmedLabel = typeof label === "string" ? label.trim() : "";

  if (!trimmedLabel) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }
  if (trimmedLabel.length > MAX_LABEL_LENGTH) {
    return NextResponse.json({ error: `Label must be ${MAX_LABEL_LENGTH} characters or fewer` }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Collision odds are astronomically low (40 bits of randomness per code),
  // but a unique-constraint retry is cheap insurance rather than a 500 on
  // the one-in-a-trillion clash.
  for (let attempt = 0; attempt < CODE_GEN_ATTEMPTS; attempt++) {
    const code = generateCode();
    const { data: created, error } = await supabase
      .from("tracking_links")
      .insert({ code, label: trimmedLabel })
      .select("id, code, label, created_at")
      .single();

    if (!error) {
      return NextResponse.json({ link: { ...created, userCount: 0 } });
    }
    if (error.code !== "23505") {
      return NextResponse.json(safeServerError("admin.tracking_link_create_failed", error), { status: 500 });
    }
  }

  return NextResponse.json({ error: "Could not generate a unique code, try again" }, { status: 500 });
}
