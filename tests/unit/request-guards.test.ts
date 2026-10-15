import { describe, it, expect, afterEach, beforeEach } from "vitest";

import {
  acquireIdempotency,
  completeIdempotency,
  hashPayload,
  hasDistributedBackend,
  idempotencyScope,
  readIdempotencyKey,
  releaseIdempotency,
  requiresDistributedBackend,
} from "@/lib/api/request-guards";
import { globalIdempotency } from "@/lib/resilience/idempotency";

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("https://example.test/api/v1/orders", { method: "POST", headers });
}

describe("readIdempotencyKey", () => {
  it("reads the canonical Idempotency-Key header", () => {
    expect(readIdempotencyKey(makeRequest({ "idempotency-key": "key-1" }))).toBe("key-1");
  });

  it("accepts the X-Idempotency-Key spelling", () => {
    expect(readIdempotencyKey(makeRequest({ "x-idempotency-key": "key-2" }))).toBe("key-2");
  });

  it("trims surrounding whitespace", () => {
    expect(readIdempotencyKey(makeRequest({ "idempotency-key": "  key-3  " }))).toBe("key-3");
  });

  it("returns null when no key is supplied", () => {
    expect(readIdempotencyKey(makeRequest())).toBeNull();
  });

  it("treats a blank key as absent rather than deduping every blank-key caller", () => {
    expect(readIdempotencyKey(makeRequest({ "idempotency-key": "   " }))).toBeNull();
  });

  it("rejects unbounded keys so they cannot be used as an unbounded cache key", () => {
    const huge = "k".repeat(201);
    expect(readIdempotencyKey(makeRequest({ "idempotency-key": huge }))).toBeNull();
  });

  it("accepts a key at the maximum length", () => {
    const max = "k".repeat(200);
    expect(readIdempotencyKey(makeRequest({ "idempotency-key": max }))).toBe(max);
  });
});

describe("hashPayload", () => {
  it("is stable for identical payloads", () => {
    expect(hashPayload({ a: 1, b: ["x"] })).toBe(hashPayload({ a: 1, b: ["x"] }));
  });

  it("differs when any field changes", () => {
    expect(hashPayload({ amount: 10 })).not.toBe(hashPayload({ amount: 11 }));
  });

  it("differs when only the item order changes, so a reshuffle is not a replay", () => {
    expect(hashPayload({ items: ["a", "b"] })).not.toBe(hashPayload({ items: ["b", "a"] }));
  });

  it("handles null and undefined without throwing", () => {
    expect(hashPayload(null)).toMatch(/^[a-f0-9]{32}$/);
    expect(hashPayload(undefined)).toBe(hashPayload(null));
  });
});

describe("hasDistributedBackend / requiresDistributedBackend", () => {
  const savedUrl = process.env.UPSTASH_REDIS_REST_URL;
  const savedToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  afterEach(() => {
    if (savedUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = savedUrl;
    if (savedToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = savedToken;
  });

  it("reports no distributed backend when Upstash is unconfigured", () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    expect(hasDistributedBackend()).toBe(false);
  });

  it("requires both URL and token, not just one", () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    expect(hasDistributedBackend()).toBe(false);
  });

  it("reports a distributed backend once both values are present", () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    expect(hasDistributedBackend()).toBe(true);
  });

  it("never demands a distributed backend outside production", () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    expect(requiresDistributedBackend()).toBe(false);
  });
});

describe("idempotency scope discipline (as used by the order route)", () => {
  beforeEach(() => {
    globalIdempotency.clear();
  });

  afterEach(() => {
    globalIdempotency.clear();
  });

  function scopeFor(tenantId: string, key: string): string {
    return idempotencyScope(tenantId, "orders.create", key);
  }

  it("namespaces the caller's key by tenant and operation", () => {
    expect(scopeFor("tenant-a", "k")).toBe("tenant-a:orders.create:k");
    expect(scopeFor("tenant-b", "k")).not.toBe(scopeFor("tenant-a", "k"));
  });

  it("replays a completed response for the same tenant, key and payload", async () => {
    const scope = scopeFor("tenant-a", "key-1");
    const hash = hashPayload({ items: 1 });

    expect((await acquireIdempotency(scope, hash)).status).toBe("acquired");
    await completeIdempotency(scope, 201, { orderId: "ord_1" }, hash);

    const replay = await acquireIdempotency(scope, hash);
    expect(replay.status).toBe("replay");
    if (replay.status === "replay") {
      expect(replay.response.statusCode).toBe(201);
      expect(replay.response.body).toEqual({ orderId: "ord_1" });
    }
  });

  it("never replays across tenants even with an identical key and payload", async () => {
    const hash = hashPayload({ items: 1 });
    const tenantA = scopeFor("tenant-a", "shared-key");

    await acquireIdempotency(tenantA, hash);
    await completeIdempotency(tenantA, 201, { orderId: "ord_a" }, hash);

    expect((await acquireIdempotency(scopeFor("tenant-b", "shared-key"), hash)).status).toBe(
      "acquired"
    );
  });

  it("replies conflict, not a second replay, when a key is reused for a different body", async () => {
    const scope = scopeFor("tenant-a", "key-3");
    const original = hashPayload({ items: 1 });

    await acquireIdempotency(scope, original);
    await completeIdempotency(scope, 201, { orderId: "ord_first" }, original);

    expect((await acquireIdempotency(scope, hashPayload({ items: 2 }))).status).toBe("conflict");
  });

  it("does not leak the internal payload fingerprint into the replayed headers", async () => {
    const scope = scopeFor("tenant-a", "key-5");
    const hash = hashPayload({ items: 1 });

    await acquireIdempotency(scope, hash);
    await completeIdempotency(scope, 201, { orderId: "ord_1" }, hash);

    const replay = await acquireIdempotency(scope, hash);
    expect(replay.status).toBe("replay");
    if (replay.status === "replay") {
      expect(replay.response.headers).toBeUndefined();
    }
  });

  it("reports a concurrent duplicate as in_flight instead of creating a second order", async () => {
    const scope = scopeFor("tenant-a", "key-2");
    const hash = hashPayload({ items: 1 });

    expect((await acquireIdempotency(scope, hash)).status).toBe("acquired");
    expect((await acquireIdempotency(scope, hash)).status).toBe("in_flight");
  });

  it("frees the key after a failure so a genuine retry can still succeed", async () => {
    const scope = scopeFor("tenant-a", "key-4");
    const hash = hashPayload({ items: 1 });

    await acquireIdempotency(scope, hash);
    await releaseIdempotency(scope);

    expect((await acquireIdempotency(scope, hash)).status).toBe("acquired");
  });
});
