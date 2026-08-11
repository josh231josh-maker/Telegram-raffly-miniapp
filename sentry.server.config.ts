import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Distinguishes Vercel's production/preview/development deploys in
  // Sentry's UI so preview-deploy noise doesn't mix into production alerts.
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,

  // Error tracking only -- performance tracing is a separate Sentry product
  // with its own event quota and wasn't asked for. Set this above 0 (e.g.
  // 0.1 for 10% of requests) if you want it later.
  tracesSampleRate: 0,

  debug: false,
});
