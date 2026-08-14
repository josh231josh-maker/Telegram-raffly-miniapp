import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "@/lib/timing-safe";
import { RATE_LIMITS, rateLimitByIp, rateLimitResponse } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

// Phase 1 only: TADS' exact postback payload shape isn't documented, so
// this doesn't try to credit anything yet -- it just proves the webhook is
// reachable and records exactly what TADS actually sends. Once a real test
// ad has been triggered and this shows up in the logs, Phase 2 adds the
// real identity-binding + crediting logic here, matching
// monetag-postback/route.ts's pattern (signed token verification, replay
// protection via record_ad_view's token_hash, referral check).
export async function GET(req: NextRequest) {
  const ipCheck = await rateLimitByIp(req, "adReward", RATE_LIMITS.adReward.ip);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const { searchParams, pathname } = new URL(req.url);
  const secret = searchParams.get("secret");

  if (!timingSafeEqual(secret, process.env.TADS_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = key === "secret" ? "<redacted>" : value;
  });

  logger.info("ads.tads_postback_received", {
    pathname,
    params,
    headers: Object.fromEntries(req.headers.entries()),
  });

  return NextResponse.json({ ok: true });
}
