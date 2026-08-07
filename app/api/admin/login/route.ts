import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ADMIN_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  safeEqual,
} from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_MAX_FAILURES = 5;
// Slows down scripted brute-force attempts regardless of outcome.
const MIN_RESPONSE_TIME_MS = 400;

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const ip = getClientIp(req);
  const supabase = getSupabaseAdmin();

  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString();
  const { count: recentFailures } = await supabase
    .from("admin_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("succeeded", false)
    .gte("created_at", windowStart);

  if ((recentFailures ?? 0) >= RATE_LIMIT_MAX_FAILURES) {
    return NextResponse.json(
      { error: "Too many failed attempts. Try again in a few minutes." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { username, password } = body as { username?: unknown; password?: unknown };

  const validUsername = safeEqual(username, process.env.ADMIN_USERNAME);
  const validPassword = safeEqual(password, process.env.ADMIN_PASSWORD);
  const success = validUsername && validPassword;

  await supabase.from("admin_login_attempts").insert({ ip, succeeded: success });

  // Pad every response to a fixed minimum time so success/failure can't be told apart by latency.
  const elapsed = Date.now() - startedAt;
  if (elapsed < MIN_RESPONSE_TIME_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_RESPONSE_TIME_MS - elapsed));
  }

  if (!success) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const store = await cookies();
  store.set(ADMIN_COOKIE_NAME, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return NextResponse.json({ success: true });
}
