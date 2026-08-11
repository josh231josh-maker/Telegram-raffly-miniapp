import * as Sentry from "@sentry/nextjs";

// Runs in the browser -- catches unhandled exceptions and unhandled promise
// rejections in client components automatically once initialized here.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,

  // Error tracking only -- performance tracing and Session Replay are
  // separate Sentry products with their own event quotas and weren't asked
  // for. Set tracesSampleRate above 0, or add Sentry.replayIntegration(),
  // if you want either later.
  tracesSampleRate: 0,

  debug: false,
});

// The SDK requires this export to instrument client-side navigations. With
// tracesSampleRate at 0 it's inert (no spans are ever sent) -- exporting it
// now just means navigation tracing works immediately if tracing is
// enabled later, without another code change.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
