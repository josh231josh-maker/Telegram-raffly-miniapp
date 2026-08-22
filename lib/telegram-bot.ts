// Thin wrapper around the Telegram Bot API — the rest of the codebase calls
// api.telegram.org ad hoc per route; this centralizes it for the broadcast
// and welcome-message features so payload shape, error, and rate-limit
// handling all live in one place.

export type InlineButton = { text: string; url: string } | { text: string; web_app: { url: string } };

// Anyone who has ever left or been kicked still gets a getChatMember row back
// with one of these two statuses, rather than an error -- everything else
// ("member", "administrator", "creator", and a supergroup's "restricted")
// means they're currently in the chat.
const NOT_A_MEMBER_STATUSES = new Set(["left", "kicked"]);

export type ChatMembershipResult =
  | { ok: true; isMember: boolean }
  | { ok: false; description: string };

/**
 * Requires the bot to already be an admin of `chatUsername` -- Telegram
 * rejects getChatMember for a channel/supergroup the bot hasn't been added
 * to as an admin with a 400 ("member list is inaccessible" or similar),
 * distinct from a real "not a member" answer for the user being checked.
 */
export async function checkChatMembership(
  botToken: string,
  chatUsername: string,
  telegramUserId: number
): Promise<ChatMembershipResult> {
  const url = new URL(`https://api.telegram.org/bot${botToken}/getChatMember`);
  url.searchParams.set("chat_id", `@${chatUsername}`);
  url.searchParams.set("user_id", String(telegramUserId));

  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    return { ok: false, description: "Network error calling Telegram" };
  }

  const data = await res.json().catch(() => null);
  if (!data?.ok) {
    return { ok: false, description: data?.description ?? "Unknown Telegram API error" };
  }

  const status: string | undefined = data.result?.status;
  return { ok: true, isMember: !!status && !NOT_A_MEMBER_STATUSES.has(status) };
}

export type SendMessageResult =
  | { ok: true }
  | { ok: false; errorCode: number; description: string; retryAfter?: number; blocked: boolean };

// Telegram's own limits: 4096 chars for a plain text message, 1024 for a
// photo's caption. Enforced both here (last line of defense before the API
// call) and at the API-route/UI layer (so the admin sees it before saving).
export const TEXT_MESSAGE_LIMIT = 4096;
export const CAPTION_LIMIT = 1024;

type SendOptions = {
  imageUrl?: string | null;
  buttons?: InlineButton[];
};

/**
 * Sends a message that's either plain text (sendMessage) or an image with
 * the text as its caption (sendPhoto) — same call site either way, so
 * broadcast processing and the /start handler don't need two code paths.
 */
export async function sendTelegramContent(
  botToken: string,
  chatId: number,
  html: string,
  options: SendOptions = {}
): Promise<SendMessageResult> {
  const { imageUrl, buttons } = options;
  const replyMarkup = buttons && buttons.length > 0 ? { inline_keyboard: buttons.map((b) => [b]) } : undefined;

  const limit = imageUrl ? CAPTION_LIMIT : TEXT_MESSAGE_LIMIT;
  if (html.length > limit) {
    return {
      ok: false,
      errorCode: 0,
      description: `Message is ${html.length} characters, over the ${limit}-character limit for ${
        imageUrl ? "an image caption" : "a text message"
      }.`,
      blocked: false,
    };
  }

  const method = imageUrl ? "sendPhoto" : "sendMessage";
  const body: Record<string, unknown> = imageUrl
    ? { chat_id: chatId, photo: imageUrl, caption: html, parse_mode: "HTML" }
    : { chat_id: chatId, text: html, parse_mode: "HTML", disable_web_page_preview: true };
  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  let res: Response;
  try {
    res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
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

export type ButtonInput = { text: string; type: "url" | "webapp"; value: string };

/**
 * Builds one inline keyboard button. "webapp" produces a real Telegram Web
 * App button (`reply_markup.inline_keyboard[].web_app.url`) so tapping it
 * opens the Mini App directly, rather than a plain link.
 */
export function buildInlineButton(input: ButtonInput, appUrl: string): InlineButton {
  if (input.type === "webapp") {
    const path = input.value.trim() || "/";
    const url = path.startsWith("http")
      ? path
      : `${appUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
    return { text: input.text, web_app: { url } };
  }
  return { text: input.text, url: input.value };
}

export function buildInlineButtons(inputs: ButtonInput[], appUrl: string): InlineButton[] {
  return inputs.map((b) => buildInlineButton(b, appUrl));
}
