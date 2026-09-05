import { describe, it, expect, beforeEach, vi } from "vitest";
import { IdempotencyManager } from "@/lib/resilience/idempotency";
import { idempotencyMiddleware } from "@/server/middleware/idempotency";
import type { Request, Response, NextFunction } from "express";

describe("IdempotencyManager (Unit)", () => {
  let manager: IdempotencyManager;

  beforeEach(() => {
    manager = new IdempotencyManager(`test:${Date.now()}:`);
    manager.clear();
  });

  it("acquires lock for fresh idempotency key", async () => {
    const result = await manager.acquire("req-123");
    expect(result.status).toBe("acquired");
  });

  it("detects in-flight key when another request holds the lock", async () => {
    const first = await manager.acquire("req-concurrent");
    expect(first.status).toBe("acquired");

    const second = await manager.acquire("req-concurrent");
    expect(second.status).toBe("in_flight");
  });

  it("returns completed cached response when key was finished", async () => {
    await manager.acquire("req-finished");
    await manager.complete("req-finished", {
      statusCode: 201,
      body: { orderId: "ord_101", total: 45.5 },
      timestamp: new Date().toISOString(),
    });

    const secondAttempt = await manager.acquire("req-finished");
    expect(secondAttempt.status).toBe("completed");
    if (secondAttempt.status === "completed") {
      expect(secondAttempt.response.statusCode).toBe(201);
      expect((secondAttempt.response.body as { orderId: string }).orderId).toBe("ord_101");
    }
  });

  it("releases lock on failure so subsequent attempts can proceed", async () => {
    await manager.acquire("req-failed");
    await manager.release("req-failed");

    const retry = await manager.acquire("req-failed");
    expect(retry.status).toBe("acquired");
  });
});

describe("idempotencyMiddleware (Express Middleware)", () => {
  interface MockRes {
    statusCode: number;
    body?: unknown;
    setHeader: (k: string, v: string) => void;
    status: (code: number) => MockRes;
    json: (body: unknown) => MockRes;
    send: (body: unknown) => MockRes;
    getHeaders: () => Record<string, string>;
  }

  function createMockResponse(): Response & { body?: unknown } {
    const headers: Record<string, string> = {};
    const mock: MockRes = {
      statusCode: 200,
      setHeader: vi.fn((k: string, v: string) => {
        headers[k.toLowerCase()] = v;
      }),
      status: vi.fn(function (this: MockRes, code: number) {
        this.statusCode = code;
        return this;
      }),
      json: vi.fn(function (this: MockRes, body: unknown) {
        this.body = body;
        return this;
      }),
      send: vi.fn(function (this: MockRes, body: unknown) {
        this.body = body;
        return this;
      }),
      getHeaders: () => headers,
    };
    return mock as unknown as Response & { body?: unknown };
  }

  it("passes through non-mutating GET requests without locking", async () => {
    const middleware = idempotencyMiddleware();
    const req = {
      method: "GET",
      headers: { "idempotency-key": "get-key-1" },
    } as unknown as Request;
    const res = createMockResponse();
    const next = vi.fn() as NextFunction;

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("deduplicates completed POST requests and replays cached body", async () => {
    const middleware = idempotencyMiddleware();
    const key = `order_test_${Date.now()}`;
    const next = vi.fn();

    // 1. First execution
    const req1 = {
      method: "POST",
      headers: { "idempotency-key": key },
    } as unknown as Request;
    const res1 = createMockResponse();

    await middleware(req1, res1, next);
    expect(next).toHaveBeenCalledTimes(1);

    // Simulate route handler sending 201 response
    res1.statusCode = 201;
    res1.json({ orderId: "ord_abc_123", success: true });

    // Wait microtick for async store
    await new Promise((r) => setTimeout(r, 10));

    // 2. Second execution with identical key
    const req2 = {
      method: "POST",
      headers: { "idempotency-key": key },
    } as unknown as Request;
    const res2 = createMockResponse();
    const next2 = vi.fn();

    await middleware(req2, res2, next2);

    expect(next2).not.toHaveBeenCalled(); // Route handler skipped!
    expect(res2.status).toHaveBeenCalledWith(201);
    expect(res2.json).toHaveBeenCalledWith({ orderId: "ord_abc_123", success: true });
    expect(res2.setHeader).toHaveBeenCalledWith("X-Cache-Lookup", "HIT-IDEMPOTENT");
  });
});
