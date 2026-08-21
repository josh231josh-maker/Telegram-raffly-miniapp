import crypto from "crypto";
import { timingSafeEqual } from "@/lib/timing-safe";

export type TelegramUser = {
  id: number;
  first_name: string;
  username?: string;
  photoUrl?: string;
  /**
   * The Mini App's `?startapp=` deep-link value, if any — e.g. the referrer's
   * telegram_id from an invite link. Read here (from inside the HMAC-covered
   * initData) rather than trusted from a client-supplied field, since
   * anything outside initData is unauthenticated and trivially spoofable.
   */
  startParam: string | null;
};

/** Beyond this, a captured/leaked initData string is rejected as a replay rather than trusted forever. */
const MAX_AUTH_AGE_SECONDS = 15 * 60;

export function verifyTelegramInitData(
  initData: string,
  botToken: string
): TelegramUser | null {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const pairs: string[] = [];
  params.forEach((value, key) => {
    pairs.push(`${key}=${value}`);
  });
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (!timingSafeEqual(computedHash, hash)) return null;

  const authDateStr = params.get("auth_date");
  const authDate = Number(authDateStr);
  if (!authDateStr || Number.isNaN(authDate)) return null;

  const ageSeconds = Date.now() / 1000 - authDate;
  if (ageSeconds > MAX_AUTH_AGE_SECONDS || ageSeconds < -60) {
    // Negative age beyond a small clock-skew allowance means auth_date is in
    // the future, which is just as suspicious as an expired one.
    return null;
  }

  const userStr = params.get("user");
  if (!userStr) return null;

  try {
    const user = JSON.parse(userStr);
    return {
      id: user.id,
      first_name: user.first_name,
      username: user.username,
      photoUrl: typeof user.photo_url === "string" ? user.photo_url : undefined,
      startParam: params.get("start_param"),
    };
  } catch {
    return null;
  }
}
