"use client";

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

// A normal error.tsx boundary can't catch errors thrown by the root layout
// itself, since the boundary would be inside the thing that crashed. This is
// the one place App Router lets you replace <html>/<body> entirely to
// recover from that.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
