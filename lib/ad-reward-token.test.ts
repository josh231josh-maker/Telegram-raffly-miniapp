import { describe, it, expect, beforeAll, vi } from "vitest";

// signAdRewardToken/verifyAdRewardToken derive their secret from
// TELEGRAM_BOT_TOKEN, so it must be set before the module is imported.
beforeAll(() => {
  process.env.TELEGRAM_BOT_TOKEN = "test-bot-token-for-unit-tests";
});

describe("ad-reward-token", () => {
  it("round-trips a valid token back to the same Telegram id", async () => {
    const { signAdRewardToken, verifyAdRewardToken } = await import("./ad-reward-token");
    const token = signAdRewardToken(123456789);
    expect(verifyAdRewardToken(token)).toBe(123456789);
  });

  it("rejects a token whose signature was tampered with", async () => {
    const { signAdRewardToken, verifyAdRewardToken } = await import("./ad-reward-token");
    const token = signAdRewardToken(123456789);
    const [id, expiresAt] = token.split(".");
    const tampered = `${id}.${expiresAt}.0000000000000000000000000000000`;
    expect(verifyAdRewardToken(tampered)).toBeNull();
  });

  it("rejects a token with the id swapped but the original signature kept", async () => {
    // This is exactly the attack this token exists to stop: a hostile
    // client can't just substitute a different Telegram id and reuse a
    // signature it doesn't have the secret to produce.
    const { signAdRewardToken, verifyAdRewardToken } = await import("./ad-reward-token");
    const token = signAdRewardToken(123456789);
    const [, expiresAt, signature] = token.split(".");
    const swapped = `999999999.${expiresAt}.${signature}`;
    expect(verifyAdRewardToken(swapped)).toBeNull();
  });

  it("rejects an expired token even with a correct signature", async () => {
    const { signAdRewardToken, verifyAdRewardToken } = await import("./ad-reward-token");
    vi.useFakeTimers();
    try {
      vi.setSystemTime(1_000_000_000_000);
      const token = signAdRewardToken(123456789);
      vi.setSystemTime(1_000_000_000_000 + 11 * 60 * 1000); // 11 minutes later, past the 10-minute TTL
      expect(verifyAdRewardToken(token)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects malformed input", async () => {
    const { verifyAdRewardToken } = await import("./ad-reward-token");
    expect(verifyAdRewardToken(null)).toBeNull();
    expect(verifyAdRewardToken("")).toBeNull();
    expect(verifyAdRewardToken("not-a-token")).toBeNull();
    expect(verifyAdRewardToken("123.456")).toBeNull(); // missing signature segment
    expect(verifyAdRewardToken("abc.456.deadbeef")).toBeNull(); // non-numeric id
  });

  it("produces a different token each time (fresh expiry), but both verify to the same id while valid", async () => {
    const { signAdRewardToken, verifyAdRewardToken } = await import("./ad-reward-token");
    const a = signAdRewardToken(42);
    const b = signAdRewardToken(42);
    expect(verifyAdRewardToken(a)).toBe(42);
    expect(verifyAdRewardToken(b)).toBe(42);
  });
});
