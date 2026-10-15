import "server-only";

import { createHash } from "node:crypto";

import { globalIdempotency, type StoredResponse } from "@/lib/resilience/idempotency";
import { rateLimit, type RateLimitResult } from "@/lib/rate-limit/limiter";

/** How long a completed idempotent response may be replayed. */
export const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

const MAX_IDEMPOTENCY_KEY_LENGTH = 200;

/**
 * True when a shared Redis backend is configured.
 *
 * Without it, the rate limiter and idempotency engine fall back to per-instance
 * memory, which cannot dedupe or throttle across serverless instances — each
 * instance would happily accept the same order again.
 */
export function hasDistributedBackend(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

/**
 * Critical write paths (the order money path) must not run on per-instance state
 * in production. When the shared backend is missing they refuse the request
 * instead of silently shipping a duplicate-order bug.
 */
export function requiresDistributedBackend(): boolean {
  return process.env.NODE_ENV === "production" && !hasDistributedBackend();
}

/**
 * Normalise a caller-supplied idempotency key. Absent or unusable keys return
 * null, which the caller treats as "dedupe not requested" — the same
 * pass-through behaviour as the Express middleware, so the two runtimes agree.
 */
export function readIdempotencyKey(request: Request): string | null {
  const raw = request.headers.get("idempotency-key") ?? request.headers.get("x-idempotency-key");
  const key = raw?.trim();
  if (!key || key.length > MAX_IDEMPOTENCY_KEY_LENGTH) return null;
  return key;
}

/**
 * Best-effort client identity for rate limiting when no credential identifies
 * the caller. Only the first proxy hop is trusted.
 */
export function clientFingerprint(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const firstHop = forwarded.split(",")[0]?.trim();
    if (firstHop) return firstHop;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Stable hash of a request payload. Recorded with the idempotency key so that
 * reusing a key for a different operation is detected and rejected rather than
 * replayed — a mutated retry must never be mistaken for the original request.
 */
export function hashPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload ?? null)).digest("hex").slice(0, 32);
}

/**
 * Namespace an idempotency key by tenant and endpoint. The caller's key is only
 * unique per tenant and per operation, so it must never be used raw.
 */
export function idempotencyScope(tenantId: string, operation: string, key: string): string {
  return `${tenantId}:${operation}:${key}`;
}

/** Key under which the payload fingerprint is recorded in `StoredResponse.meta`. */
const PAYLOAD_HASH_META = "payloadHash";

export type IdempotencyAcquisition =
  | { status: "acquired"; scope: string }
  | { status: "replay"; response: StoredResponse }
  | { status: "conflict" }
  | { status: "in_flight" };

/**
 * Take execution rights for an idempotency scope.
 *
 * - `acquired`  — first time we have seen this key; the caller may proceed.
 * - `replay`    — the identical operation already completed; return the stored response.
 * - `conflict`  — the key was already used for a **different** body.
 * - `in_flight` — an identical request is being processed right now.
 */
export async function acquireIdempotency(
  scope: string,
  payloadHash: string
): Promise<IdempotencyAcquisition> {
  const result = await globalIdempotency.acquire(scope, IDEMPOTENCY_TTL_SECONDS);

  if (result.status === "completed") {
    const recordedHash = result.response.meta?.[PAYLOAD_HASH_META];
    if (recordedHash && recordedHash !== payloadHash) {
      return { status: "conflict" };
    }
    return { status: "replay", response: result.response };
  }

  if (result.status === "in_flight") return { status: "in_flight" };
  return { status: "acquired", scope };
}

export async function completeIdempotency(
  scope: string,
  statusCode: number,
  body: unknown,
  payloadHash: string
): Promise<void> {
  await globalIdempotency.complete(
    scope,
    {
      statusCode,
      body,
      timestamp: new Date().toISOString(),
      meta: { [PAYLOAD_HASH_META]: payloadHash },
    },
    IDEMPOTENCY_TTL_SECONDS
  );
}

export async function releaseIdempotency(scope: string): Promise<void> {
  await globalIdempotency.release(scope);
}

export function applyRateLimit(
  key: string,
  max: number,
  windowMs: number
): Promise<RateLimitResult> {
  return rateLimit(key, max, windowMs);
}
