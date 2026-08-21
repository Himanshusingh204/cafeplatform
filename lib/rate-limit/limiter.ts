import "server-only";

// In-memory sliding-window rate limiter.
// Production note: on serverless/Vercel use a Redis-backed limiter (Upstash).
// The interface stays the same so swapping is a drop-in change.

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

function prune(now: number) {
  if (store.size < 10_000) return;
  for (const [key, bucket] of store) {
    if (bucket.resetAt < now) store.delete(key);
  }
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function rateLimit(
  key: string,
  max: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  prune(now);

  const bucket = store.get(key);
  if (!bucket || bucket.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: max - 1, retryAfterMs: 0 };
  }

  if (bucket.count >= max) {
    return {
      success: false,
      remaining: 0,
      retryAfterMs: bucket.resetAt - now,
    };
  }

  bucket.count += 1;
  return {
    success: true,
    remaining: max - bucket.count,
    retryAfterMs: 0,
  };
}