// Thin wrapper around the Telegram Bot API's sendMessage — the rest of the
// codebase calls api.telegram.org ad hoc per route; this centralizes it for
// the broadcast feature so error/rate-limit handling lives in one place.

export type InlineButton = { text: string; url: string } | { text: string; web_app: { url: string } };

export type SendMessageResult =
  | { ok: true }
  | { ok: false; errorCode: number; description: string; retryAfter?: number; blocked: boolean };

export async function sendTelegramMessage(
  botToken: string,
  chatId: number,
  html: string,
  button?: InlineButton
): Promise<SendMessageResult> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text: html,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };
  if (button) {
    body.reply_markup = { inline_keyboard: [[button]] };
  }

  let res: Response;
  try {
    res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, errorCode: 0, description: "Network error calling Telegram", blocked: false };
  }

  const data = await res.json().catch(() => null);
  if (data?.ok) return { ok: true };

  const errorCode: number = data?.error_code ?? res.status;
  const description: string = data?.description ?? "Unknown Telegram API error";
  const retryAfter: number | undefined = data?.parameters?.retry_after;
  // Both are permanent, not transient: 403 covers "bot was blocked" and "user
  // is deactivated"; a 400 "chat not found" means Telegram has no private
  // chat on record for this user at all (they've never actually opened a
  // conversation with the bot, even if they have a row in our users table
  // via the Mini App). Neither will resolve itself on retry, so this chat
  // should be excluded from future broadcasts the same way a block is.
  const blocked = errorCode === 403 || (errorCode === 400 && /chat not found/i.test(description));

  return { ok: false, errorCode, description, retryAfter, blocked };
}

/**
 * Builds the inline keyboard button for a broadcast. "webapp" produces a
 * real Telegram Web App button (`reply_markup.inline_keyboard[].web_app.url`)
 * so tapping it opens the Mini App directly, rather than a plain link.
 */
export function buildInlineButton(
  type: "url" | "webapp",
  text: string,
  value: string,
  appUrl: string
): InlineButton {
  if (type === "webapp") {
    const path = value.trim() || "/";
    const url = path.startsWith("http")
      ? path
      : `${appUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
    return { text, web_app: { url } };
  }
  return { text, url: value };
}
