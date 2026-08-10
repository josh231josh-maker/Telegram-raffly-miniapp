import crypto from "crypto";
import { timingSafeEqual } from "@/lib/timing-safe";

/**
 * Binds a verified Telegram id to a short-lived, server-signed token that's
 * safe to hand to a third-party ad SDK.
 *
 * Why this exists: ad networks (Monetag) relay a client-supplied id straight
 * back to our postback with no verification of their own -- Telegram's own
 * initData signature can't travel through their webhook, so without this,
 * the id used to credit a reward is whatever raw value our client-side code
 * asserted, which a hostile client could swap for someone else's id. Minting
 * this token server-side (only after verifying real initData) and having the
 * postback route verify it back closes that gap: a tampered id fails
 * signature verification instead of being trusted.
 */

const TOKEN_TTL_MS = 10 * 60 * 1000; // covers the full two-ad watch flow with margin

/** Derived from the bot token rather than a new env var, same pattern as lib/admin-auth.ts's session secret. */
function tokenSecret(): string {
  return crypto
    .createHmac("sha256", process.env.TELEGRAM_BOT_TOKEN!)
    .update("ad-reward-token-secret")
    .digest("hex");
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", tokenSecret()).update(payload).digest("hex").slice(0, 32);
}

export function signAdRewardToken(telegramId: number): string {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = `${telegramId}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns the verified Telegram id if the token is authentic and unexpired, otherwise null. */
export function verifyAdRewardToken(token: string | null): number | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [telegramIdRaw, expiresAtRaw, signature] = parts;

  const telegramId = Number(telegramIdRaw);
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(telegramId) || !Number.isFinite(expiresAt)) return null;

  const payload = `${telegramIdRaw}.${expiresAtRaw}`;
  if (!timingSafeEqual(signature, sign(payload))) return null;
  if (Date.now() > expiresAt) return null;

  return telegramId;
}
