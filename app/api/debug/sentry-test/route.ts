import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

// Temporary diagnostic: reports what the server-side Sentry client actually
// sees at runtime (DSN presence, whether a client initialized at all) plus
// attempts a real captureException + flush, so we can tell apart "DSN
// missing/misconfigured" from "event sent but not yet indexed" from "sent
// but Sentry silently rejected it". Removed once the pipeline is confirmed
// working end-to-end -- not meant to stay in the app.
export async function GET() {
  const client = Sentry.getClient();
  const dsn = client?.getOptions().dsn;

  const eventId = Sentry.captureException(
    new Error("Raffly Sentry pipeline test (diagnostic) — safe to ignore, this route is removed after verification")
  );
  const flushed = await Sentry.flush(5000);

  return NextResponse.json({
    hasClient: !!client,
    dsnConfigured: !!dsn,
    dsnHost: dsn ? new URL(dsn).host : null,
    dsnProjectId: dsn ? new URL(dsn).pathname.replace("/", "") : null,
    environment: client?.getOptions().environment,
    eventId,
    flushed,
  });
}
