import { NextResponse } from "next/server";

// Retired: the Adsgram SDK script is still loaded (components/mini-app-shell.tsx)
// but nothing in the client has ever invoked it since the Adsgram hook was
// removed -- Monetag is the only ad network actually wired into the watch-ad
// flow. This endpoint had no real caller, yet accepted a raw client-supplied
// userid gated only by a static shared secret (no per-session binding like
// Monetag's signed ad-reward token), making it a live ticket-farming hole for
// anyone who ever learned that secret. Since nothing depends on it, retiring
// it outright is safer than retrofitting the same token-binding scheme
// Monetag uses for an integration that isn't in use. If Adsgram is wired up
// again in the future, rebuild this the way monetag-postback/route.ts does:
// mint a signed token from verified initData before showing the ad, and
// verify it back here instead of trusting a raw id.
export async function GET() {
  return NextResponse.json({ error: "Gone" }, { status: 410 });
}
