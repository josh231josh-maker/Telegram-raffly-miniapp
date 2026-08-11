import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    const adminSecurityHeaders = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "same-origin" },
      { key: "Cache-Control", value: "no-store" },
    ];
    // Applied to every route including /admin (these two are identical to
    // the admin-only values above, so it's a harmless no-op duplicate
    // there). Deliberately omits X-Frame-Options/frame-ancestors being
    // restrictive on the main app -- it must stay embeddable inside
    // Telegram's own clients (Telegram Web loads it in an iframe), so
    // frame-ancestors only needs to keep out sites that AREN'T Telegram,
    // not block framing outright the way the admin dashboard does.
    const baseSecurityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "same-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), usb=()" },
      {
        key: "Content-Security-Policy",
        value: "frame-ancestors 'self' https://web.telegram.org https://*.web.telegram.org",
      },
    ];
    return [
      { source: "/:path*", headers: baseSecurityHeaders },
      { source: "/admin/:path*", headers: adminSecurityHeaders },
      { source: "/api/admin/:path*", headers: adminSecurityHeaders },
    ];
  },
};

// Wraps the config to upload source maps at build time (so Sentry shows
// original source instead of minified/bundled code) and auto-instruments
// API route handlers, Vercel Cron jobs, and server actions for error
// capture. The upload step needs SENTRY_ORG/SENTRY_PROJECT/SENTRY_AUTH_TOKEN;
// without them it just skips uploading and logs a notice at build time --
// it never fails the build.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // TEMPORARY: forced visible (not gated on SENTRY_DEBUG) for one deploy to
  // confirm the newly-added SENTRY_ORG/SENTRY_PROJECT/SENTRY_AUTH_TOKEN
  // actually upload source maps, since silent mode suppresses the warning
  // for a missing token too -- silence alone can't distinguish success from
  // failure. Revert to `!process.env.SENTRY_DEBUG` right after confirming.
  silent: false,

  // Widens the set of client files scanned for source maps -- needed for
  // Next.js's route-grouped output to map correctly back to source.
  widenClientFileUpload: true,

  webpack: {
    // Strips Sentry's own debug logging statements, and all tracing/
    // performance-monitoring code (unused since tracesSampleRate is 0 in
    // every config file), out of the client bundle.
    treeshake: { removeDebugLogging: true, removeTracing: true },

    // Both cron jobs in vercel.json (raffle draw, broadcast processing) get
    // auto-registered as Sentry Cron Monitors -- alerts if a run is late,
    // fails, or never fires, on top of catching thrown errors.
    automaticVercelMonitors: true,
  },
});
