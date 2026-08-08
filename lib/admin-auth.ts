import crypto from "crypto";
import { cookies } from "next/headers";
import { timingSafeEqual } from "@/lib/timing-safe";

export const ADMIN_COOKIE_NAME = "admin_session";

const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours
export const SESSION_MAX_AGE_SECONDS = SESSION_DURATION_MS / 1000;

/** Derived from the admin password rather than stored separately, so no extra env var is needed. */
function sessionSecret(): string {
  return crypto
    .createHmac("sha256", process.env.ADMIN_PASSWORD!)
    .update("admin-session-secret")
    .digest("hex");
}

function sign(expiresAt: number): string {
  return crypto.createHmac("sha256", sessionSecret()).update(String(expiresAt)).digest("hex");
}

export const safeEqual = timingSafeEqual;

/** Session token = expiry + HMAC signature, so it expires on its own and can't be forged without the password. */
export function createSessionToken(): string {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  return `${expiresAt}.${sign(expiresAt)}`;
}

export function isValidSessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const [expiresAtRaw, signature] = token.split(".");
  const expiresAt = Number(expiresAtRaw);
  if (!expiresAtRaw || !signature || Number.isNaN(expiresAt)) return false;
  if (Date.now() > expiresAt) return false;

  return safeEqual(signature, sign(expiresAt));
}

export async function isAdminAuthed(): Promise<boolean> {
  const store = await cookies();
  return isValidSessionToken(store.get(ADMIN_COOKIE_NAME)?.value);
}

export async function verifyAdminAuth(): Promise<{ id: string } | null> {
  const isAuthed = await isAdminAuthed();
  return isAuthed ? { id: "admin" } : null;
}
