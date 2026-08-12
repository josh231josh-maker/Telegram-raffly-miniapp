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
  const supabase = getSupabaseAdmin();

  const { data: link, error: fetchError } = await supabase
    .from("tracking_links")
    .select("code")
    .eq("id", id)
    .single();

  if (fetchError || !link) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  // The FK on users.acquisition_link_code is NO ACTION, same as every other
  // FK in this schema (see admin_delete_user) -- deleting the link row
  // outright would just fail for any link with attributed users, so clear
  // the reference first. This intentionally drops which link brought those
  // users in; the users themselves and everything else about them are
  // untouched.
  const { error: clearError } = await supabase
    .from("users")
    .update({ acquisition_link_code: null })
    .eq("acquisition_link_code", link.code);

  if (clearError) {
    return NextResponse.json(
      safeServerError("admin.tracking_link_clear_users_failed", clearError, { linkId: id }),
      { status: 500 }
    );
  }

  const { error: deleteError } = await supabase.from("tracking_links").delete().eq("id", id);

  if (deleteError) {
    return NextResponse.json(
      safeServerError("admin.tracking_link_delete_failed", deleteError, { linkId: id }),
      { status: 500 }
    );
  }

  logger.warn("admin.tracking_link_deleted", { linkId: id, code: link.code });

  return NextResponse.json({ success: true });
}
