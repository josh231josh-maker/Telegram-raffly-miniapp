import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { TEXT_MESSAGE_LIMIT, CAPTION_LIMIT, type ButtonInput } from "@/lib/telegram-bot";
import { RATE_LIMITS, rateLimitByIp, rateLimitResponse } from "@/lib/rate-limit";
import { safeServerError } from "@/lib/logger";

const MAX_BUTTONS = 8;

function validateButtons(buttons: unknown): ButtonInput[] | { error: string } {
  if (!buttons) return [];
  if (!Array.isArray(buttons)) return { error: "Buttons must be a list" };
  if (buttons.length > MAX_BUTTONS) return { error: `At most ${MAX_BUTTONS} buttons are allowed` };

  const cleaned: ButtonInput[] = [];
  for (const b of buttons) {
    const text = typeof b?.text === "string" ? b.text.trim() : "";
    const type = b?.type === "webapp" ? "webapp" : b?.type === "url" ? "url" : null;
    const value = typeof b?.value === "string" ? b.value.trim() : "";
    if (!text || !type) {
      return { error: "Every button needs text and an action" };
    }
    // A Mini App button's destination is a path within the app and can be left
    // blank (defaults to the home screen) -- only a plain link button needs a URL.
    if (type === "url" && !value) {
      return { error: `Button "${text}" needs a destination URL` };
    }
    if (type === "url" && !/^https?:\/\//i.test(value)) {
      return { error: `Button "${text}" needs a valid http(s) URL` };
    }
    if (type === "webapp" && /^https?:\/\/(www\.)?(t|telegram)\.me\//i.test(value)) {
      return {
        error: `Button "${text}" is set to "Open Mini App" but its destination is a t.me link -- leave it blank or use "Open a link" instead`,
      };
    }
    cleaned.push({ text, type, value });
  }
  return cleaned;
}

export async function GET(req: NextRequest) {
  const adminUser = await verifyAdminAuth();
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ipCheck = await rateLimitByIp(req, "adminRead", RATE_LIMITS.adminRead.ip);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const supabase = getSupabaseAdmin();
  const { data: settings, error } = await supabase.from("welcome_message_settings").select("*").eq("id", true).single();
  if (error || !settings) {
    return NextResponse.json(
      safeServerError("admin.welcome_message_load_failed", error ?? new Error("no settings row"), undefined, "Failed to load settings"),
      { status: 500 }
    );
  }

  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  const adminUser = await verifyAdminAuth();
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ipCheck = await rateLimitByIp(req, "adminWrite", RATE_LIMITS.adminWrite.ip);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const body = await req.json();
  const { messageHtml, imageUrl, buttons, enabled } = body as {
    messageHtml?: string;
    imageUrl?: string;
    buttons?: unknown;
    enabled?: boolean;
  };

  const cleanButtons = validateButtons(buttons);
  if ("error" in cleanButtons) {
    return NextResponse.json({ error: cleanButtons.error }, { status: 400 });
  }

  const html = messageHtml ?? "";
  // Enabling requires an actual message -- otherwise every /start would
  // silently reply with nothing, which would look broken rather than off.
  if (enabled && !html.trim()) {
    return NextResponse.json({ error: "Message is required to enable the welcome message" }, { status: 400 });
  }
  const limit = imageUrl ? CAPTION_LIMIT : TEXT_MESSAGE_LIMIT;
  if (html.length > limit) {
    return NextResponse.json(
      {
        error: `Message is ${html.length} characters, over the ${limit}-character limit for ${
          imageUrl ? "an image caption" : "a text message"
        }.`,
      },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: settings, error } = await supabase
    .from("welcome_message_settings")
    .update({
      message_html: html,
      image_url: imageUrl?.trim() || null,
      buttons: cleanButtons,
      enabled: !!enabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true)
    .select()
    .single();

  if (error || !settings) {
    return NextResponse.json(
      safeServerError("admin.welcome_message_save_failed", error ?? new Error("no settings row"), undefined, "Failed to save settings"),
      { status: 500 }
    );
  }

  return NextResponse.json({ settings });
}
