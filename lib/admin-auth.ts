import crypto from "crypto";
import { cookies } from "next/headers";

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

/** Constant-time string comparison that tolerates length mismatches and missing input. */
export function safeEqual(input: unknown, expected: string | undefined): boolean {
  if (typeof input !== "string" || !expected) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    // Still run a comparison so failure timing doesn't leak the length mismatch.
    crypto.timingSafeEqual(a, a);
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

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
