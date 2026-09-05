/**
 * Enterprise Idempotency Engine
 * Provides request deduplication across distributed environments with Redis & memory fallback.
 */

export interface StoredResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: unknown;
  timestamp: string;
}

interface IdempotencyRecord {
  status: "PROCESSING" | "COMPLETED";
  response?: StoredResponse;
  expiresAt: number;
}

const memRecords = new Map<string, IdempotencyRecord>();
const MAX_MEM_RECORDS = 5000;

function pruneMemoryRecords(now: number) {
  if (memRecords.size < MAX_MEM_RECORDS) return;
  for (const [k, record] of memRecords) {
    if (record.expiresAt <= now) {
      memRecords.delete(k);
    }
  }
}

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const hasUpstash = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

export type AcquireResult =
  | { status: "acquired" }
  | { status: "in_flight" }
  | { status: "completed"; response: StoredResponse };

export class IdempotencyManager {
  private keyPrefix: string;

  constructor(prefix: string = "idempotency:") {
    this.keyPrefix = prefix;
  }

  private formatKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  /**
   * Attempt to acquire execution rights for an idempotency key.
   */
  async acquire(key: string, ttlSeconds: number = 86400): Promise<AcquireResult> {
    const fullKey = this.formatKey(key);
    const now = Date.now();

    if (hasUpstash) {
      try {
        const checkRes = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(fullKey)}`, {
          headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
        });

        if (checkRes.ok) {
          const checkJson = await checkRes.json();
          if (checkJson.result) {
            const parsed = typeof checkJson.result === "string" ? JSON.parse(checkJson.result) : checkJson.result;
            if (parsed.status === "COMPLETED" && parsed.response) {
              return { status: "completed", response: parsed.response };
            }
            return { status: "in_flight" };
          }
        }

        // Try to set NX
        const setNxRes = await fetch(
          `${UPSTASH_URL}/set/${encodeURIComponent(fullKey)}/${encodeURIComponent(
            JSON.stringify({ status: "PROCESSING", timestamp: now })
          )}?nx&ex=${ttlSeconds}`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
          }
        );

        if (setNxRes.ok) {
          const setNxJson = await setNxRes.json();
          if (setNxJson.result === "OK") {
            return { status: "acquired" };
          }
        }

        return { status: "in_flight" };
      } catch (err) {
        console.warn(`[IdempotencyManager] Upstash acquire failed for ${fullKey}, using memory:`, err);
      }
    }

    // In-memory fallback
    pruneMemoryRecords(now);
    const existing = memRecords.get(fullKey);

    if (existing && existing.expiresAt > now) {
      if (existing.status === "COMPLETED" && existing.response) {
        return { status: "completed", response: existing.response };
      }
      return { status: "in_flight" };
    }

    // Acquire lock
    memRecords.set(fullKey, {
      status: "PROCESSING",
      expiresAt: now + ttlSeconds * 1000,
    });

    return { status: "acquired" };
  }

  /**
   * Save the completed response payload for the key.
   */
  async complete(key: string, response: StoredResponse, ttlSeconds: number = 86400): Promise<void> {
    const fullKey = this.formatKey(key);
    const now = Date.now();
    const record: IdempotencyRecord = {
      status: "COMPLETED",
      response,
      expiresAt: now + ttlSeconds * 1000,
    };

    if (hasUpstash) {
      try {
        await fetch(
          `${UPSTASH_URL}/set/${encodeURIComponent(fullKey)}/${encodeURIComponent(
            JSON.stringify(record)
          )}?ex=${ttlSeconds}`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
          }
        );
        return;
      } catch (err) {
        console.warn(`[IdempotencyManager] Upstash complete failed for ${fullKey}:`, err);
      }
    }

    memRecords.set(fullKey, record);
  }

  /**
   * Release an acquired key if an operation aborted or failed before completion.
   */
  async release(key: string): Promise<void> {
    const fullKey = this.formatKey(key);

    if (hasUpstash) {
      try {
        await fetch(`${UPSTASH_URL}/del/${encodeURIComponent(fullKey)}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
        });
      } catch (err) {
        console.warn(`[IdempotencyManager] Upstash release failed for ${fullKey}:`, err);
      }
    }

    memRecords.delete(fullKey);
  }

  /**
   * Clear all records (useful in testing).
   */
  clear(): void {
    memRecords.clear();
  }
}

export const globalIdempotency = new IdempotencyManager("idempotency:");
