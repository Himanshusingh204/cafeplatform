import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({ db: {} }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { buildErrorBody, codeForStatus, resolveRequestId } from "@/lib/api/errors";
import { clientFingerprint, hashPayload, idempotencyScope, readIdempotencyKey } from "@/lib/api/request-guards";
import { OUTBOX_MAX_ATTEMPTS, outboxBackoffMs } from "@/lib/outbox/process";

describe("codeForStatus", () => {
  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "not_found"],
    [409, "conflict"],
    [429, "rate_limited"],
    [503, "service_unavailable"],
    [500, "internal_error"],
    [502, "internal_error"],
    [400, "invalid_request"],
    [422, "invalid_request"],
  ])("maps %i to %s", (status, code) => {
    expect(codeForStatus(status)).toBe(code);
  });
});

describe("buildErrorBody / resolveRequestId", () => {
  it("echoes a safe incoming request id", () => {
    const req = new Request("http://x.test", { headers: { "x-request-id": "abc-123_.X" } });
    const { requestId, body } = buildErrorBody(404, "Missing", undefined, { hint: "h" }, req);
    expect(requestId).toBe("abc-123_.X");
    expect(body).toEqual({ hint: "h", error: "Missing", code: "not_found", requestId: "abc-123_.X" });
  });

  it("replaces unsafe or absent ids with a fresh uuid", () => {
    const bad = new Request("http://x.test", { headers: { "x-request-id": "bad id<script>" } });
    expect(resolveRequestId(bad)).toMatch(/^[0-9a-f-]{36}$/);
    expect(resolveRequestId()).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("lets extra keys never override error/code", () => {
    const { body } = buildErrorBody(429, "Slow down", "rate_limited", { error: "x", code: "y" });
    expect(body.error).toBe("Slow down");
    expect(body.code).toBe("rate_limited");
  });
});

describe("outboxBackoffMs", () => {
  it("doubles from 30s and caps at one hour", () => {
    expect(outboxBackoffMs(1)).toBe(30_000);
    expect(outboxBackoffMs(2)).toBe(60_000);
    expect(outboxBackoffMs(3)).toBe(120_000);
    expect(outboxBackoffMs(OUTBOX_MAX_ATTEMPTS)).toBe(960_000);
    expect(outboxBackoffMs(30)).toBe(3_600_000);
  });
  it("treats zero or negative attempts as the first attempt", () => {
    expect(outboxBackoffMs(0)).toBe(30_000);
    expect(outboxBackoffMs(-4)).toBe(30_000);
  });
});

describe("request-guards helpers", () => {
  const req = (h: Record<string, string>) => new Request("http://x.test", { headers: h });

  it("reads and trims the idempotency key, rejecting empty and oversized", () => {
    expect(readIdempotencyKey(req({ "idempotency-key": "  k1 " }))).toBe("k1");
    expect(readIdempotencyKey(req({ "x-idempotency-key": "k2" }))).toBe("k2");
    expect(readIdempotencyKey(req({ "idempotency-key": "   " }))).toBeNull();
    expect(readIdempotencyKey(req({ "idempotency-key": "k".repeat(500) }))).toBeNull();
    expect(readIdempotencyKey(req({}))).toBeNull();
  });

  it("uses only the first forwarded hop, then x-real-ip, then unknown", () => {
    expect(clientFingerprint(req({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }))).toBe("1.1.1.1");
    expect(clientFingerprint(req({ "x-real-ip": "3.3.3.3" }))).toBe("3.3.3.3");
    expect(clientFingerprint(req({}))).toBe("unknown");
  });

  it("hashes payloads deterministically and scopes keys", () => {
    expect(hashPayload({ a: 1 })).toBe(hashPayload({ a: 1 }));
    expect(hashPayload({ a: 1 })).not.toBe(hashPayload({ a: 2 }));
    expect(hashPayload(undefined)).toBe(hashPayload(null));
    expect(hashPayload({}).length).toBe(32);
    expect(idempotencyScope("t", "orders", "k")).toBe("t:orders:k");
  });
});
