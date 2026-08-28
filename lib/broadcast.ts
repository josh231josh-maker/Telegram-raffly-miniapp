import type { SupabaseClient } from "@supabase/supabase-js";
import { sendTelegramContent, buildInlineButtons, type ButtonInput } from "@/lib/telegram-bot";

const BATCH_SIZE = 40;
// Telegram allows roughly 30 messages/sec across all chats -- 70ms between
// sends keeps us comfortably under that even with request overhead on top.
const SEND_DELAY_MS = 70;
// Leaves headroom under Vercel's 60s timeout (hobby plan max), accounting for
// database overhead and Telegram API latency. At 40 messages × 70ms = 2.8s
// sends + overhead, most batches complete in ~20–30s, well under the limit.
const TIME_BUDGET_MS = 45_000;

type Broadcast = {
  id: string;
  message_html: string;
  image_url: string | null;
  buttons: ButtonInput[] | null;
  status: string;
};

export type ProcessResult = {
  status: string;
  sent: number;
  failed: number;
  remaining: number;
};

/**
 * Claims and sends one batch of pending recipients for a broadcast, then
 * recomputes the broadcast's aggregate counts/status from the recipient
 * rows (source of truth) rather than incrementing counters, so it can never
 * drift even if a batch is interrupted or overlaps with another caller.
 */
export async function processBroadcastBatch(
  supabase: SupabaseClient,
  broadcast: Broadcast,
  botToken: string,
  appUrl: string
): Promise<ProcessResult> {
  const startedAt = Date.now();
  const buttons = broadcast.buttons && broadcast.buttons.length > 0 ? buildInlineButtons(broadcast.buttons, appUrl) : undefined;

  while (Date.now() - startedAt < TIME_BUDGET_MS) {
    // Re-check cancellation between batches so a "Cancel" click mid-send
    // stops further sends promptly instead of racing to completion.
    const { data: current } = await supabase.from("broadcasts").select("status").eq("id", broadcast.id).single();
    if (current?.status === "canceled") break;

    const { data: claimed, error: claimError } = await supabase.rpc("claim_broadcast_recipients", {
      p_broadcast_id: broadcast.id,
      p_limit: BATCH_SIZE,
    });

    if (claimError) {
      console.error(`[broadcast:${broadcast.id}] claim failed`, claimError.message);
      break;
    }
    if (!claimed || claimed.length === 0) break;

    for (const recipient of claimed) {
      const result = await sendTelegramContent(botToken, recipient.telegram_id, broadcast.message_html, {
        imageUrl: broadcast.image_url,
        buttons,
      });

      if (result.ok) {
        await supabase
          .from("broadcast_recipients")
          .update({ status: "sent", sent_at: new Date().toISOString(), error: null })
          .eq("id", recipient.id);
      } else {
        // A rate-limit hit is retried once after Telegram's own cooldown --
        // anything else (blocked, bad chat, malformed message) is final.
        if (result.retryAfter && result.retryAfter <= 5) {
          await new Promise((resolve) => setTimeout(resolve, result.retryAfter! * 1000));
          const retry = await sendTelegramContent(botToken, recipient.telegram_id, broadcast.message_html, {
            imageUrl: broadcast.image_url,
            buttons,
          });
          if (retry.ok) {
            await supabase
              .from("broadcast_recipients")
              .update({ status: "sent", sent_at: new Date().toISOString(), error: null })
              .eq("id", recipient.id);
            continue;
          }
        }

        await supabase
          .from("broadcast_recipients")
          .update({ status: "failed", error: result.description })
          .eq("id", recipient.id);

        if (result.blocked) {
          // A bot-only contact (messaged the bot, never opened the mini app)
          // has no users row to flag, so its block is recorded by telegram_id
          // instead -- bot_only_contacts() filters those out, so a later
          // broadcast doesn't keep messaging someone who has blocked the bot.
          if (recipient.user_id) {
            await supabase
              .from("users")
              .update({ bot_blocked_at: new Date().toISOString() })
              .eq("id", recipient.user_id);
          } else {
            await supabase
              .from("bot_blocked_contacts")
              .upsert({ telegram_id: recipient.telegram_id }, { onConflict: "telegram_id" });
          }
        }
      }

      await new Promise((resolve) => setTimeout(resolve, SEND_DELAY_MS));
    }
  }

  const { count: sentCount } = await supabase
    .from("broadcast_recipients")
    .select("id", { count: "exact", head: true })
    .eq("broadcast_id", broadcast.id)
    .eq("status", "sent");

  const { count: failedCount } = await supabase
    .from("broadcast_recipients")
    .select("id", { count: "exact", head: true })
    .eq("broadcast_id", broadcast.id)
    .eq("status", "failed");

  const { count: pendingCount } = await supabase
    .from("broadcast_recipients")
    .select("id", { count: "exact", head: true })
    .eq("broadcast_id", broadcast.id)
    .in("status", ["pending", "sending"]);

  const sent = sentCount ?? 0;
  const failed = failedCount ?? 0;
  const remaining = pendingCount ?? 0;

  const { data: freshBroadcast } = await supabase
    .from("broadcasts")
    .select("status")
    .eq("id", broadcast.id)
    .single();

  const isCanceled = freshBroadcast?.status === "canceled";
  const nextStatus = isCanceled ? "canceled" : remaining === 0 ? "completed" : "sending";

  await supabase
    .from("broadcasts")
    .update({
      sent_count: sent,
      failed_count: failed,
      status: nextStatus,
      ...(nextStatus === "completed" ? { completed_at: new Date().toISOString() } : {}),
    })
    .eq("id", broadcast.id);

  console.log(`[broadcast:${broadcast.id}] batch done sent=${sent} failed=${failed} remaining=${remaining}`);

  return { status: nextStatus, sent, failed, remaining };
}
