import crypto from "crypto";

/** Constant-time string comparison that tolerates length mismatches and missing input. */
export function timingSafeEqual(input: unknown, expected: string | undefined): boolean {
  if (typeof input !== "string" || !expected) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    // Still run a comparison so failure timing doesn't leak the length mismatch.
    crypto.timingSafeEqual(a, a);
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}
