import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

// Temporary: confirms the corrected NEXT_PUBLIC_SENTRY_DSN actually reaches
// the right Sentry project after the env var fix. Removed once verified.
export async function GET() {
  const client = Sentry.getClient();
  const dsn = client?.getOptions().dsn;

  const eventId = Sentry.captureException(
    new Error("Raffly Sentry pipeline test (post-DSN-fix) — safe to ignore, this route is removed after verification")
  );
  const flushed = await Sentry.flush(5000);

  return NextResponse.json({
    dsnProjectId: dsn ? new URL(dsn).pathname.replace("/", "") : null,
    eventId,
    flushed,
  });
}
