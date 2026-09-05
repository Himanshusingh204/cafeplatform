import { describe, it, expect, beforeEach } from "vitest";
import { CacheManager } from "@/lib/cache/cache-manager";

describe("CacheManager (Unit)", () => {
  let cache: CacheManager;

  beforeEach(() => {
    cache = new CacheManager(`test:${Date.now()}:`);
    cache.clear();
  });

  it("stores and retrieves values", async () => {
    await cache.set("dish:1", { name: "Biryani", price: 18.5 }, 60);
    const dish = await cache.get<{ name: string; price: number }>("dish:1");

    expect(dish).not.toBeNull();
    expect(dish?.name).toBe("Biryani");
    expect(dish?.price).toBe(18.5);
  });

  it("returns null for non-existent or expired keys", async () => {
    const missing = await cache.get("missing-key");
    expect(missing).toBeNull();

    // Expired TTL (0 seconds)
    await cache.set("instant-expire", "data", 0);
    // Wait tiny tick
    await new Promise((r) => setTimeout(r, 10));
    const expired = await cache.get("instant-expire");
    expect(expired).toBeNull();
  });

  it("deletes individual keys and prefix groups", async () => {
    await cache.set("menu:cat1", { id: 1 });
    await cache.set("menu:cat2", { id: 2 });
    await cache.set("orders:1", { id: 100 });

    await cache.deleteByPrefix("menu:");

    expect(await cache.get("menu:cat1")).toBeNull();
    expect(await cache.get("menu:cat2")).toBeNull();
    expect(await cache.get("orders:1")).not.toBeNull();
  });

  it("implements cache-aside getOrSet correctly", async () => {
    let fetchCount = 0;
    const fetcher = async () => {
      fetchCount += 1;
      return { loadedAt: Date.now(), items: ["chai", "samosa"] };
    };

    // First call: MISS -> runs factory
    const result1 = await cache.getOrSet("hot-items", fetcher, 60);
    expect(result1.fromCache).toBe(false);
    expect(fetchCount).toBe(1);

    // Second call: HIT -> returns cached data
    const result2 = await cache.getOrSet("hot-items", fetcher, 60);
    expect(result2.fromCache).toBe(true);
    expect(fetchCount).toBe(1);
    expect(result2.data.items).toEqual(["chai", "samosa"]);
  });
});
