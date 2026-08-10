import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { RATE_LIMITS, rateLimitByIp, rateLimitResponse } from "@/lib/rate-limit";
import { safeServerError } from "@/lib/logger";

const BUCKET = "admin-content-images";
const MAX_BYTES = 5 * 1024 * 1024; // matches the bucket's own file_size_limit and Telegram's practical
// limit for a photo fetched by URL (larger files risk sendPhoto failing to fetch it at all).
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// Shared by the broadcast composer and the welcome-message editor -- both
// just need "give me a public URL for this image" so Telegram's sendPhoto
// (which takes a URL, not a raw upload) can fetch it.
export async function POST(req: NextRequest) {
  const adminUser = await verifyAdminAuth();
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ipCheck = await rateLimitByIp(req, "adminExpensive", RATE_LIMITS.adminExpensive.ip);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No image file provided" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported image type -- use JPEG, PNG, WebP, or GIF" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image is too large -- max 5MB" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Image file is empty" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const extension = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
  const path = `${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadError) {
    return NextResponse.json(safeServerError("admin.image_upload_failed", uploadError), { status: 500 });
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
