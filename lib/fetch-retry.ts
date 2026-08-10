/**
 * Retries a fetch automatically on network failure, a 5xx server error, or a
 * 429 (rate limited) -- all cases where trying again shortly after has a
 * real chance of succeeding, unlike other 4xx responses (bad request,
 * unauthorized), which are returned immediately since retrying won't change
 * the outcome. Exponential backoff over ~15s; a 429's own Retry-After header
 * is honored when present instead of guessing.
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  attempts = 6,
  baseDelayMs = 500
): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    let res: Response | undefined;
    try {
      res = await fetch(input, init);
      const isRetryable = !res.ok && (res.status >= 500 || res.status === 429);
      if (!isRetryable) {
        return res;
      }
      lastError = new Error(`Server error: ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    if (i < attempts - 1) {
      const retryAfterMs = Number(res?.headers.get("Retry-After")) * 1000;
      const delayMs = Number.isFinite(retryAfterMs) && retryAfterMs > 0 ? retryAfterMs : baseDelayMs * 2 ** i;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}
