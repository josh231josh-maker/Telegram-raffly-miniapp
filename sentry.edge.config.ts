import * as Sentry from "@sentry/nextjs";

// Covers Edge Runtime code (middleware, edge API routes) -- this project
// doesn't use either today, but this makes error capture work immediately
// if either is added later, at zero cost until then.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0,
  debug: false,
});
