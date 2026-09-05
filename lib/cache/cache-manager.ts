/**
 * Resilient Cache-Aside Manager
 * Supports Upstash Redis REST API when configured, with seamless in-memory fallback.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const memCache = new Map<string, CacheEntry<unknown>>();
const MAX_MEM_CACHE_ENTRIES = 5000;

function pruneMemoryCache(now: number) {
  if (memCache.size < MAX_MEM_CACHE_ENTRIES) return;
  for (const [key, entry] of memCache) {
    if (entry.expiresAt <= now) {
      memCache.delete(key);
    }
  }
}

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const hasUpstash = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

export class CacheManager {
  private prefix: string;

  constructor(prefix: string = "cafe:") {
    this.prefix = prefix;
  }

  private formatKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  /**
   * Retrieve an item from cache.
   */
  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.formatKey(key);

    if (hasUpstash) {
      try {
        const res = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(fullKey)}`, {
          headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
        });
        if (res.ok) {
          const json = await res.json();
          if (json.result !== null && json.result !== undefined) {
            try {
              return JSON.parse(json.result) as T;
            } catch {
              return json.result as T;
            }
          }
        }
      } catch (err) {
        console.warn(`[CacheManager] Upstash read failed for key ${fullKey}, falling back to memory:`, err);
      }
    }

    const now = Date.now();
    const entry = memCache.get(fullKey);
    if (!entry) return null;

    if (entry.expiresAt <= now) {
      memCache.delete(fullKey);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Set an item in cache with TTL in seconds (default 300s / 5m).
   */
  async set<T>(key: string, value: T, ttlSeconds: number = 300): Promise<void> {
    const fullKey = this.formatKey(key);
    const serialized = JSON.stringify(value);

    if (hasUpstash) {
      try {
        await fetch(`${UPSTASH_URL}/set/${encodeURIComponent(fullKey)}/${encodeURIComponent(serialized)}?ex=${ttlSeconds}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
        });
        return;
      } catch (err) {
        console.warn(`[CacheManager] Upstash write failed for key ${fullKey}, writing to memory:`, err);
      }
    }

    const now = Date.now();
    pruneMemoryCache(now);
    memCache.set(fullKey, {
      value,
      expiresAt: now + ttlSeconds * 1000,
    });
  }

  /**
   * Delete an item from cache.
   */
  async delete(key: string): Promise<void> {
    const fullKey = this.formatKey(key);

    if (hasUpstash) {
      try {
        await fetch(`${UPSTASH_URL}/del/${encodeURIComponent(fullKey)}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
        });
      } catch (err) {
        console.warn(`[CacheManager] Upstash delete failed for key ${fullKey}:`, err);
      }
    }

    memCache.delete(fullKey);
  }

  /**
   * Delete all keys matching a prefix.
   */
  async deleteByPrefix(pattern: string): Promise<void> {
    const targetPrefix = this.formatKey(pattern);

    // In-memory purge
    for (const key of memCache.keys()) {
      if (key.startsWith(targetPrefix)) {
        memCache.delete(key);
      }
    }

    if (hasUpstash) {
      try {
        const keysRes = await fetch(`${UPSTASH_URL}/keys/${encodeURIComponent(targetPrefix + "*")}`, {
          headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
        });
        if (keysRes.ok) {
          const keysData = await keysRes.json();
          const keys: string[] = keysData.result || [];
          if (keys.length > 0) {
            await fetch(`${UPSTASH_URL}/del`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${UPSTASH_TOKEN}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(keys),
            });
          }
        }
      } catch (err) {
        console.warn(`[CacheManager] Upstash deleteByPrefix failed for ${targetPrefix}:`, err);
      }
    }
  }

  /**
   * Cache-Aside Helper: fetch or calculate and cache.
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds: number = 300
  ): Promise<{ data: T; fromCache: boolean }> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return { data: cached, fromCache: true };
    }

    const fresh = await factory();
    await this.set(key, fresh, ttlSeconds);
    return { data: fresh, fromCache: false };
  }

  /**
   * Purge all items (primarily for tests).
   */
  clear(): void {
    memCache.clear();
  }
}

export const globalCache = new CacheManager("cafe:");
