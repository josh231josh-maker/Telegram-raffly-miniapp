import * as Sentry from "@sentry/nextjs";

// Runs in the browser -- catches unhandled exceptions and unhandled promise
// rejections in client components automatically once initialized here. That
// includes rejections from code we never wrote and have no promise handle
// to: the two ad network scripts (Monetag's sdk.js, TADS' widget.js) run
// their own real-time bidding across ad exchanges internally, and a losing
// exchange's own timeout promise rejects independently of whatever public
// promise their show()/init() call hands back to us -- our own calls into
// them are already properly awaited and try/caught (see
// components/monetag-interstitial.tsx), so this is genuinely nothing our
// code can catch, not a gap in our error handling.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,

  // Error tracking only -- performance tracing and Session Replay are
  // separate Sentry products with their own event quotas and weren't asked
  // for. Set tracesSampleRate above 0, or add Sentry.replayIntegration(),
  // if you want either later.
  tracesSampleRate: 0,

  debug: false,

  // denyUrls matches by the originating script's URL, so it drops any error
  // or rejection Sentry can attribute to these two domains regardless of
  // the exact message text (ad exchange timeout wording varies by which
  // exchange lost the bid). ignoreErrors is a message-text fallback for the
  // rare case a rejection has no attributable stack frame at all (fully
  // inlined/eval'd code) and so can't be matched by URL.
  denyUrls: [/libtl\.com/i, /tads\.me/i],
  ignoreErrors: [/adex timeout/i],
});

// The SDK requires this export to instrument client-side navigations. With
// tracesSampleRate at 0 it's inert (no spans are ever sent) -- exporting it
// now just means navigation tracing works immediately if tracing is
// enabled later, without another code change.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
