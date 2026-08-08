/**
 * Defense-in-depth for Telegram profile fields (first_name, username): strips
 * control and zero-width/invisible characters and trims length before they
 * ever reach storage. React already escapes these on render and no bot
 * message uses parse_mode HTML/Markdown, so this isn't closing a demonstrated
 * XSS — it's just refusing to persist junk that could confuse a future
 * rendering context (a CSV export, an HTML email, a log viewer) that isn't
 * as careful.
 */
const CONTROL_AND_INVISIBLE_CHARS = new RegExp(
  "[\\u0000-\\u001F\\u007F-\\u009F\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2064\\uFEFF]",
  "g"
);

export function sanitizeProfileText(value: string | null | undefined, maxLength = 128): string | null {
  if (!value) return null;
  const stripped = value.replace(CONTROL_AND_INVISIBLE_CHARS, "").trim();
  return stripped ? stripped.slice(0, maxLength) : null;
}
