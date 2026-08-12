import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

// Temporary: proves the Sentry pipeline captures a real, uncaught server
// error end-to-end (not just a manual captureException call), with a stack
// trace that source-maps back to this exact file/line. Removed once
// confirmed in the Sentry dashboard -- not meant to stay in the app.
//
// Explicitly captures + flushes here (rather than just throwing) because
// Vercel's serverless runtime can freeze/terminate the function as soon as
// the response is sent -- any fire-and-forget async work still in flight,
// like the HTTP POST Sentry's transport makes to deliver the event, can get
// cut off before it completes. Sentry.flush() blocks the response until
// that POST is confirmed sent.
export async function GET() {
  const eventId = Sentry.captureException(
    new Error("Raffly Sentry pipeline test (explicit flush) — safe to ignore, this route is removed after verification")
  );
  const flushed = await Sentry.flush(5000);
  return NextResponse.json({ eventId, flushed });
}
