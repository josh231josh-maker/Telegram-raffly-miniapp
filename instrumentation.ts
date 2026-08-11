import * as Sentry from "@sentry/nextjs";

// Next.js calls register() once per server runtime on startup -- this is
// where server-side (Node) and edge-runtime Sentry init live, kept in
// separate files so each only pulls in the SDK code its own runtime needs.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Reports errors thrown inside App Router request handling (route handlers,
// server components, server actions) that escape any local try/catch --
// the last-resort net behind the explicit Sentry.captureException call in
// lib/logger.ts's safeServerError.
export const onRequestError = Sentry.captureRequestError;
