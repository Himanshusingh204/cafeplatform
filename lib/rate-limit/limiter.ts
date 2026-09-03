import "server-only";

// Rate limiter with Upstash Redis support for serverless deployments.
// Falls back to in-memory when UPSTASH_REDIS_REST_URL is not configured.
// The interface stays the same so swapping is seamless.

interface Bucket {
  count: number;
  resetAt: number;
}

const memStore = new Map<string, Bucket>();

function prune(now: number) {
  if (memStore.size < 10_000) return;
  for (const [key, bucket] of memStore) {
    if (bucket.resetAt < now) memStore.delete(key);
  }
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  retryAfterMs: number;
}

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function upstashSlidingWindow(
  key: string,
  max: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - windowMs;
  const rlKey = `rl:${key}`;

  const response = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["ZREMRANGEBYSCORE", rlKey, "-inf", windowStart],
      ["ZADD", rlKey, now, `${now}-${Math.random().toString(36).slice(2, 8)}`],
      ["ZCARD", rlKey],
      ["PEXPIRE", rlKey, windowMs],
    ]),
  });

  const results = await response.json();
  const count = results[2]?.result ?? 0;

  if (count > max) {
    return { success: false, remaining: 0, retryAfterMs: windowMs };
  }

  return { success: true, remaining: max - count, retryAfterMs: 0 };
}

function memSlidingWindow(
  key: string,
  max: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  prune(now);

  const bucket = memStore.get(key);
  if (!bucket || bucket.resetAt < now) {
    memStore.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: max - 1, retryAfterMs: 0 };
  }

  if (bucket.count >= max) {
    return { success: false, remaining: 0, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { success: true, remaining: max - bucket.count, retryAfterMs: 0 };
}

export async function rateLimit(
  key: string,
  max: number,
  windowMs: number
): Promise<RateLimitResult> {
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      return await upstashSlidingWindow(key, max, windowMs);
    } catch {
      return memSlidingWindow(key, max, windowMs);
    }
  }
  return memSlidingWindow(key, max, windowMs);
}
