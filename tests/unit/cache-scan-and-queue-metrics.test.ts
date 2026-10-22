import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("CacheManager.deleteByPrefix (Redis)", () => {
  it("uses SCAN with a cursor loop and never KEYS", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "t");
    const calls: string[] = [];
    const pages = [
      { result: ["17", ["cafe:menu:1"]] },
      { result: ["0", ["cafe:menu:2"]] },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        return { ok: true, json: async () => (url.includes("/scan/") ? pages.shift() : { result: 1 }) };
      })
    );
    const { CacheManager } = await import("@/lib/cache/cache-manager");
    await new CacheManager("cafe:").deleteByPrefix("menu:");
    expect(calls.some((c) => c.includes("/keys/"))).toBe(false);
    expect(calls.filter((c) => c.includes("/scan/"))).toHaveLength(2);
    expect(calls[2]).toContain("/scan/17/");
    expect(calls.filter((c) => c.endsWith("/del"))).toHaveLength(2);
  });
});

describe("JobQueue metrics", () => {
  it("keeps cumulative completed/failed and a real processing count", async () => {
    const { JobQueue } = await import("@/lib/queue/job-queue");
    const q = new JobQueue(5);
    let during = -1;
    q.registerHandler("ok", async () => {
      during = q.getMetrics().processing;
    });
    q.registerHandler("bad", async () => {
      throw new Error("x");
    });
    q.enqueue("ok", {});
    q.enqueue("bad", {}, { maxRetries: 0 });
    q.enqueue("nohandler", {});
    await vi.waitFor(() => expect(q.getMetrics().completed + q.getMetrics().failed).toBe(3), { timeout: 3000 });
    const m = q.getMetrics();
    expect(during).toBe(1);
    expect(m).toMatchObject({ processing: 0, completed: 1, failed: 2, dlq: 2 });
    await q.drain();
  });
});
