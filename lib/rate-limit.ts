import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Distributed (Upstash Redis) rate limiting — safe across Vercel's many
 * independent serverless instances, unlike an in-memory counter which would
 * reset per-instance and let an attacker bypass the limit just by hitting a
 * cold instance.
 *
 * If UPSTASH_REDIS_REST_URL/TOKEN aren't set, limiting is disabled (fails
 * open) rather than crashing every route — this keeps local dev working
 * without Redis provisioned. A loud console.error marks this on cold start
 * so a production deploy missing the env vars is obvious in Vercel logs.
 */
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

if (!redis && process.env.NODE_ENV === "production") {
  console.error(
    "[rate-limit] UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN are not set — rate limiting is DISABLED in production."
  );
}

export type RateLimitRule = { requests: number; window: `${number} s` | `${number} m` | `${number} h` };

/**
 * Documented per-operation limits. Each protected route enforces an
 * IP-scoped rule (stops floods regardless of identity, including
 * pre-authentication) and, once a request's Telegram identity has been
 * verified via HMAC, a tighter per-user rule keyed on that verified id — not
 * anything the client supplies directly — so switching a client-sent user id
 * cannot widen the effective limit.
 */
export const RATE_LIMITS = {
  // Called on every app open; generous since it's read-mostly and cheap.
  auth: {
    ip: { requests: 30, window: "60 s" },
    user: { requests: 20, window: "60 s" },
  },
  // Once-per-day feature; a handful of retries is normal, dozens is not.
  checkin: {
    ip: { requests: 20, window: "60 s" },
    user: { requests: 5, window: "60 s" },
  },
  raffleEntryRead: {
    ip: { requests: 60, window: "60 s" },
    user: { requests: 30, window: "60 s" },
  },
  raffleEntryWrite: {
    ip: { requests: 20, window: "60 s" },
    user: { requests: 10, window: "60 s" },
  },
  passClaim: {
    ip: { requests: 20, window: "60 s" },
    user: { requests: 5, window: "60 s" },
  },
  walletConnect: {
    ip: { requests: 20, window: "60 s" },
    user: { requests: 5, window: "60 s" },
  },
  // Financial and gated further by withdrawals_one_active_per_user at the DB
  // level, but a tight limit still stops request-spam cost abuse.
  withdraw: {
    ip: { requests: 10, window: "10 m" },
    user: { requests: 3, window: "10 m" },
  },
  // Each call hits the Telegram Bot API (createInvoiceLink) — worth capping
  // independently of the generic per-user budget.
  createInvoice: {
    ip: { requests: 20, window: "60 s" },
    user: { requests: 10, window: "60 s" },
  },
  // Telegram delivers updates from its own infrastructure; the secret-token
  // check gates authenticity, this just bounds worst-case volume per source IP.
  telegramWebhook: {
    ip: { requests: 120, window: "60 s" },
  },
  // Ad-network postback endpoints: shared secret gates authenticity, then
  // both the caller's IP and the target Telegram id are capped.
  adReward: {
    ip: { requests: 60, window: "60 s" },
    user: { requests: 20, window: "60 s" },
  },
  // Cheap read-only admin endpoints (lists, detail views).
  adminRead: {
    ip: { requests: 60, window: "60 s" },
  },
  // Admin actions that write to the DB or call an external API.
  adminWrite: {
    ip: { requests: 30, window: "60 s" },
  },
  // Genuinely expensive: fans out to the Telegram API per-recipient or
  // uploads a file to storage.
  adminExpensive: {
    ip: { requests: 10, window: "60 s" },
  },
} as const satisfies Record<string, { ip: RateLimitRule; user?: RateLimitRule }>;

const limiters = new Map<string, Ratelimit>();

function getLimiter(cacheKey: string, rule: RateLimitRule): Ratelimit | null {
  if (!redis) return null;
  let limiter = limiters.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(rule.requests, rule.window),
      prefix: "raffly:ratelimit",
      analytics: false,
    });
    limiters.set(cacheKey, limiter);
  }
  return limiter;
}

export type RateLimitOutcome = { allowed: boolean; retryAfterSeconds?: number };

async function check(cacheKey: string, identifier: string, rule: RateLimitRule): Promise<RateLimitOutcome> {
  const limiter = getLimiter(cacheKey, rule);
  if (!limiter) return { allowed: true };
  try {
    const result = await limiter.limit(identifier);
    if (result.success) return { allowed: true };
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)) };
  } catch (err) {
    // Fail open on Redis errors — a rate-limiter outage should degrade
    // gracefully, not take the whole app down.
    console.error(`[rate-limit] check failed for ${cacheKey}, failing open`, err);
    return { allowed: true };
  }
}

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** IP-scoped check — call before any authentication or DB work so pure request floods are rejected cheaply. */
export function rateLimitByIp(req: NextRequest, name: string, rule: RateLimitRule): Promise<RateLimitOutcome> {
  return check(`${name}:ip`, getClientIp(req), rule);
}

/** Identity-scoped check — call only with a server-verified id (HMAC-checked Telegram id, admin session, etc.), never a raw client-supplied field. */
export function rateLimitByUser(name: string, verifiedId: string | number, rule: RateLimitRule): Promise<RateLimitOutcome> {
  return check(`${name}:user`, String(verifiedId), rule);
}

/** Uniform 429 response — no internal limiter details (bucket name, remaining count, backend) are ever exposed to the client. */
export function rateLimitResponse(outcome: RateLimitOutcome): NextResponse {
  return NextResponse.json(
    { error: "Too many requests. Please slow down and try again shortly." },
    {
      status: 429,
      headers: outcome.retryAfterSeconds ? { "Retry-After": String(outcome.retryAfterSeconds) } : undefined,
    }
  );
}
