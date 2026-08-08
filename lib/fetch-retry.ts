/**
 * Retries a fetch automatically on network failure or a 5xx server error --
 * both common on flaky mobile connections -- with exponential backoff over
 * ~15s. A 4xx response is returned immediately since retrying a client error
 * (bad request, unauthorized) won't change the outcome.
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  attempts = 6,
  baseDelayMs = 500
): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(input, init);
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        return res;
      }
      lastError = new Error(`Server error: ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** i));
    }
  }
  throw lastError;
}
