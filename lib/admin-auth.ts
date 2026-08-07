import crypto from "crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE_NAME = "admin_session";

function expectedToken(): string {
  const password = process.env.ADMIN_PASSWORD!;
  return crypto.createHmac("sha256", password).update("admin-session").digest("hex");
}

export function isValidAdminToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const expected = expectedToken();
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function isAdminAuthed(): Promise<boolean> {
  const store = await cookies();
  return isValidAdminToken(store.get(ADMIN_COOKIE_NAME)?.value);
}

export function adminSessionToken(): string {
  return expectedToken();
}
