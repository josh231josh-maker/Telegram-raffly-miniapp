import crypto from "crypto";
import * as Sentry from "@sentry/nextjs";

/**
 * Lightweight structured logging for Vercel's serverless environment.
 * Vercel captures stdout/stderr per-invocation and makes it searchable in
 * the Logs tab (and forwards it to any log drain configured there), so a
 * single JSON line per event is enough to get filterable, greppable logs
 * without adding an external APM dependency the project doesn't have yet.
 *
 * Never pass secrets or full Telegram initData into `fields` — initData
 * contains the user's raw Telegram profile and an HMAC; log derived,
 * non-sensitive identifiers (telegramId, userId) instead.
 */
type LogFields = Record<string, unknown>;

function emit(level: "info" | "warn" | "error", event: string, fields?: LogFields) {
  const line = JSON.stringify({ level, event, time: new Date().toISOString(), ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (event: string, fields?: LogFields) => emit("info", event, fields),
  warn: (event: string, fields?: LogFields) => emit("warn", event, fields),
  error: (event: string, fields?: LogFields) => emit("error", event, fields),
};

/** One id per request, threaded through logs so related lines can be correlated in the Vercel log viewer. */
export function newRequestId(): string {
  return crypto.randomUUID();
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Logs the real error (with internal detail) server-side and returns a
 * generic message to the client — callers never see stack traces, SQL
 * errors, or other internals, regardless of what Postgres/Supabase reported.
 *
 * Includes a fresh correlation id in both the log line and the response so
 * a user reporting "something went wrong" can hand back an id that's
 * greppable in Vercel's logs, without exposing any actual error detail.
 *
 * This is the one place nearly every unexpected server-side failure across
 * the app already flows through (every call site here returns a 500),
 * unlike routine 400/401/404/409 business errors which are returned
 * directly by each route without going through here — so it's also the
 * single funnel for reporting to Sentry, tagged with the same event name
 * and requestId as the log line for correlation. err isn't always a real
 * Error (Supabase/Postgrest errors are plain objects), so it's normalized
 * into one first; Sentry can still capture a non-Error value directly, but
 * loses the ability to group/search on a stable message.
 */
export function safeServerError(
  event: string,
  err: unknown,
  fields?: LogFields,
  clientMessage = "Something went wrong. Please try again."
): { error: string; requestId: string } {
  const requestId = newRequestId();
  logger.error(event, { ...fields, requestId, error: errorMessage(err) });
  Sentry.captureException(err instanceof Error ? err : new Error(`${event}: ${errorMessage(err)}`), {
    tags: { event },
    extra: { ...fields, requestId },
  });
  return { error: clientMessage, requestId };
}
