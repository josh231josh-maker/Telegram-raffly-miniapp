import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { logger } from "@/lib/logger";

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
  // Public, unauthenticated (no verified identity to key a per-user limit
  // on) -- the 10s shared CDN cache absorbs the common case, but a flood
  // across many edge PoPs or with cache-busting still reaches this function
  // and its 4 DB round-trips uncapped without an IP-scoped floor.
  raffleInfo: {
    ip: { requests: 60, window: "60 s" },
  },
  raffleEntryWrite: {
    ip: { requests: 20, window: "60 s" },
    user: { requests: 10, window: "60 s" },
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
  // Mints the signed token that binds an ad-watch session to a verified
  // Telegram id -- called once per ad-watch attempt from the Mini App.
  adRewardTokenMint: {
    ip: { requests: 20, window: "60 s" },
    user: { requests: 10, window: "60 s" },
  },
  // Ad-network postback endpoints: shared secret proves the call really
  // came from the ad network, then both the caller's IP and the target
  // Telegram id are capped. Note: unlike every other `user` limit below,
  // this id is NOT HMAC-verified by us -- it's whatever the ad SDK relayed
  // back, which traces to a value our own client asserted when the ad
  // started. See the ad-reward trust-boundary note on rateLimitByUser.
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
    const retryAfterSeconds = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
    // Tracks rate-limit violations for monitoring, and doubles as a way to
    // see exactly which identifier (IP or verified user id) tripped which
    // limiter -- useful for telling apart a real abuse pattern from a
    // shared/rotating IP innocently bumping into the limit.
    logger.warn("rate_limit.blocked", { scope: cacheKey, identifier, retryAfterSeconds });
    return { allowed: false, retryAfterSeconds };
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

// A single legitimate user switching wifi/mobile data might show 2 distinct
// IPs in a short window -- 3+ is past normal roaming and worth a look. This
// is monitoring only, not enforcement: a verified id is never blocked or
// throttled just for spanning IPs, since that alone isn't proof of abuse
// (shared connection, VPN, carrier IP rotation are all legitimate).
const IDENTITY_IP_ANOMALY_THRESHOLD = 3;
const IDENTITY_IP_ANOMALY_WINDOW_SECONDS = 10 * 60;

/**
 * Records that this verified identity was just seen from this IP, and warns
 * if the same identity has now shown up from an unusually high number of
 * distinct IPs within the window -- e.g. a leaked/replayed initData being
 * driven from several machines at once. A single IP itself can be spoofed
 * or shared, which is exactly why this looks at the *pattern* tied to an
 * unspoofable identity (the HMAC-verified Telegram id) rather than trying
 * to treat any one IP or client-reported "device id" as trustworthy on its
 * own -- see the rate-limit design notes for why device fingerprints aren't
 * used as a security signal here.
 */
async function trackIdentityIp(scopeName: string, verifiedId: string | number, ip: string): Promise<void> {
  if (!redis || ip === "unknown") return;
  try {
    const key = `raffly:iptrack:${scopeName}:${verifiedId}`;
    const pipeline = redis.pipeline();
    pipeline.sadd(key, ip);
    pipeline.expire(key, IDENTITY_IP_ANOMALY_WINDOW_SECONDS);
    pipeline.scard(key);
    const results = await pipeline.exec<[number, number, number]>();
    const distinctIpCount = results[2];
    if (distinctIpCount >= IDENTITY_IP_ANOMALY_THRESHOLD) {
      logger.warn("identity.multi_ip_anomaly", {
        scope: scopeName,
        identifier: String(verifiedId),
        distinctIpCount,
        windowSeconds: IDENTITY_IP_ANOMALY_WINDOW_SECONDS,
      });
    }
  } catch (err) {
    console.error(`[rate-limit] identity IP-anomaly tracking failed for ${scopeName}`, err);
  }
}

/**
 * Identity-scoped check — call with a server-verified id (HMAC-checked
 * Telegram id, admin session, etc.), never a raw client-supplied field.
 *
 * Exception: the `adReward` callers pass a Telegram id that is *not*
 * HMAC-verified by us -- third-party ad SDKs have no way to carry Telegram's
 * signed initData through their own completion webhook, so the id they
 * relay back traces only to whatever our own client-side code asserted when
 * the ad started, which a sufficiently hostile client could swap for a
 * different id. That's an accepted, bounded trust gap for that one
 * integration point (see the production-hardening report), not something
 * this function itself can close -- everywhere else, "verifiedId" here
 * really is cryptographically verified.
 */
export async function rateLimitByUser(
  req: NextRequest,
  name: string,
  verifiedId: string | number,
  rule: RateLimitRule
): Promise<RateLimitOutcome> {
  await trackIdentityIp(name, verifiedId, getClientIp(req));
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
