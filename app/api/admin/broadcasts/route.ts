import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { TEXT_MESSAGE_LIMIT, CAPTION_LIMIT, type ButtonInput } from "@/lib/telegram-bot";
import { RATE_LIMITS, rateLimitByIp, rateLimitResponse } from "@/lib/rate-limit";
import { safeServerError } from "@/lib/logger";

const SEGMENTS = ["all", "active_pass", "no_pass", "has_tickets", "selected"] as const;
type Segment = (typeof SEGMENTS)[number];

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
  const { data: broadcasts, error } = await supabase
    .from("broadcasts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json(safeServerError("admin.broadcasts_list_failed", error), { status: 500 });
  }

  return NextResponse.json({ broadcasts: broadcasts ?? [] });
}

export async function POST(req: NextRequest) {
  const adminUser = await verifyAdminAuth();
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ipCheck = await rateLimitByIp(req, "adminWrite", RATE_LIMITS.adminWrite.ip);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const body = await req.json();
  const { title, messageHtml, imageUrl, buttons, segment, selectedTelegramIds, idempotencyKey } = body as {
    title?: string;
    messageHtml?: string;
    imageUrl?: string;
    buttons?: unknown;
    segment?: Segment;
    selectedTelegramIds?: number[];
    idempotencyKey?: string;
  };

  if (!messageHtml || !messageHtml.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }
  const limit = imageUrl ? CAPTION_LIMIT : TEXT_MESSAGE_LIMIT;
  if (messageHtml.length > limit) {
    return NextResponse.json(
      {
        error: `Message is ${messageHtml.length} characters, over the ${limit}-character limit for ${
          imageUrl ? "an image caption" : "a text message"
        }.`,
      },
      { status: 400 }
    );
  }
  if (!segment || !SEGMENTS.includes(segment)) {
    return NextResponse.json({ error: "Invalid segment" }, { status: 400 });
  }
  if (segment === "selected" && (!selectedTelegramIds || selectedTelegramIds.length === 0)) {
    return NextResponse.json({ error: "No users selected" }, { status: 400 });
  }

  const cleanButtons = validateButtons(buttons);
  if ("error" in cleanButtons) {
    return NextResponse.json({ error: cleanButtons.error }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // A double-submit of the exact same compose action (double-click, retried
  // request) returns the already-created draft instead of making a second one.
  if (idempotencyKey) {
    const { data: existing } = await supabase
      .from("broadcasts")
      .select("*")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existing) {
      const { count } = await supabase
        .from("broadcast_recipients")
        .select("id", { count: "exact", head: true })
        .eq("broadcast_id", existing.id);
      return NextResponse.json({ broadcast: existing, recipientCount: count ?? 0, excludedCount: 0 });
    }
  }

  let query = supabase.from("users").select("id, telegram_id").is("bot_blocked_at", null);

  if (segment === "active_pass") {
    query = query.gt("raffly_pass_expires_at", new Date().toISOString());
  } else if (segment === "no_pass") {
    query = query.or(`raffly_pass_expires_at.is.null,raffly_pass_expires_at.lte.${new Date().toISOString()}`);
  } else if (segment === "has_tickets") {
    query = query.gt("ticket_balance", 0);
  } else if (segment === "selected") {
    query = query.in("telegram_id", selectedTelegramIds!);
  }

  const { data: recipients, error: recipientsError } = await query;
  if (recipientsError) {
    return NextResponse.json(safeServerError("admin.broadcast_recipients_query_failed", recipientsError), { status: 500 });
  }

  const excludedCount = segment === "selected" ? selectedTelegramIds!.length - (recipients?.length ?? 0) : 0;

  if (!recipients || recipients.length === 0) {
    return NextResponse.json({ error: "No eligible recipients match this selection" }, { status: 400 });
  }

  const { data: broadcast, error: insertError } = await supabase
    .from("broadcasts")
    .insert({
      title: title?.trim() || null,
      message_html: messageHtml,
      image_url: imageUrl?.trim() || null,
      buttons: cleanButtons,
      segment,
      selected_telegram_ids: segment === "selected" ? selectedTelegramIds : null,
      total_recipients: recipients.length,
      idempotency_key: idempotencyKey || null,
    })
    .select()
    .single();

  if (insertError || !broadcast) {
    return NextResponse.json(
      safeServerError("admin.broadcast_create_failed", insertError ?? new Error("insert returned no row"), undefined, "Failed to create broadcast"),
      { status: 500 }
    );
  }

  const recipientRows = recipients.map((u) => ({
    broadcast_id: broadcast.id,
    user_id: u.id,
    telegram_id: u.telegram_id,
  }));

  const { error: recipientInsertError } = await supabase.from("broadcast_recipients").insert(recipientRows);
  if (recipientInsertError) {
    // Roll back the orphaned draft rather than leaving a broadcast with no recipients.
    await supabase.from("broadcasts").delete().eq("id", broadcast.id);
    return NextResponse.json(
      safeServerError("admin.broadcast_recipients_insert_failed", recipientInsertError, { broadcastId: broadcast.id }, "Failed to create broadcast"),
      { status: 500 }
    );
  }

  return NextResponse.json({ broadcast, recipientCount: recipients.length, excludedCount });
}
