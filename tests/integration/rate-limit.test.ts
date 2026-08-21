import { describe, expect, it } from "vitest";

import { rateLimit } from "@/lib/rate-limit/limiter";

describe("rateLimit", () => {
  it("allows requests up to the configured maximum", () => {
    const key = `test-allow-${Math.random()}`;

    expect(rateLimit(key, 3, 60_000).success).toBe(true);
    expect(rateLimit(key, 3, 60_000).remaining).toBe(1);
    expect(rateLimit(key, 3, 60_000).success).toBe(true);
    expect(rateLimit(key, 3, 60_000).success).toBe(false);
  });

  it("reports a retry delay once blocked", () => {
    const key = `test-block-${Math.random()}`;
    rateLimit(key, 1, 60_000);

    const blocked = rateLimit(key, 1, 60_000);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("isolates buckets per key so one client cannot lock out another", () => {
    const a = `test-iso-a-${Math.random()}`;
    const b = `test-iso-b-${Math.random()}`;

    rateLimit(a, 1, 60_000);
    expect(rateLimit(a, 1, 60_000).success).toBe(false);
    expect(rateLimit(b, 1, 60_000).success).toBe(true);
  });

  it("allows requests again after the window elapses", async () => {
    const key = `test-window-${Math.random()}`;
    rateLimit(key, 1, 80);

    expect(rateLimit(key, 1, 80).success).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(rateLimit(key, 1, 80).success).toBe(true);
  });
});
