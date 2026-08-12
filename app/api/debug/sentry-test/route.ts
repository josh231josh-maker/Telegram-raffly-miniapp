// Temporary: proves the Sentry pipeline captures a real, uncaught server
// error end-to-end (not just a manual captureException call), with a stack
// trace that source-maps back to this exact file/line. Removed once
// confirmed in the Sentry dashboard -- not meant to stay in the app.
export async function GET() {
  throw new Error("Raffly Sentry pipeline test — safe to ignore, this route is removed after verification");
}
