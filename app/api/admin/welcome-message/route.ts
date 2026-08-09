import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { TEXT_MESSAGE_LIMIT, CAPTION_LIMIT, type ButtonInput } from "@/lib/telegram-bot";

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
    if (!text || !type || !value) {
      return { error: "Every button needs text, an action, and a destination" };
    }
    if (type === "url" && !/^https?:\/\//i.test(value)) {
      return { error: `Button "${text}" needs a valid http(s) URL` };
    }
    cleaned.push({ text, type, value });
  }
  return cleaned;
}

export async function GET() {
  const adminUser = await verifyAdminAuth();
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data: settings, error } = await supabase.from("welcome_message_settings").select("*").eq("id", true).single();
  if (error || !settings) {
    return NextResponse.json({ error: error?.message ?? "Failed to load settings" }, { status: 500 });
  }

  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  const adminUser = await verifyAdminAuth();
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    return NextResponse.json({ error: error?.message ?? "Failed to save settings" }, { status: 500 });
  }

  return NextResponse.json({ settings });
}
