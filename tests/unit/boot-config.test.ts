import { describe, it, expect } from "vitest";

import { assertValidEnv, ConfigError, findConfigProblems } from "@/lib/config/env";
import { buildPoolConfig } from "@/lib/db/pool-config";

const prodBase = {
  NODE_ENV: "production",
  DATABASE_URL: "postgres://secret-host/db",
  AUTH_SECRET: "super-secret-value",
  APP_URL: "https://example.test",
};

describe("boot config validation", () => {
  it("passes outside production with nothing set", () => {
    expect(findConfigProblems({ NODE_ENV: "development" })).toEqual([]);
  });

  it("requires Redis or an explicit waiver in production", () => {
    expect(findConfigProblems(prodBase).join(" ")).toContain("UPSTASH_REDIS_REST_URL");
    expect(
      findConfigProblems({ ...prodBase, UPSTASH_REDIS_REST_URL: "u", UPSTASH_REDIS_REST_TOKEN: "t" })
    ).toEqual([]);
    expect(findConfigProblems({ ...prodBase, ALLOW_IN_MEMORY_STATE: "true" })).toEqual([]);
  });

  it("aggregates missing names and never leaks values", () => {
    try {
      assertValidEnv({ NODE_ENV: "production", AUTH_SECRET: "leak-me-not" });
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      const message = (err as Error).message;
      expect(message).toContain("DATABASE_URL");
      expect(message).toContain("APP_URL");
      expect(message).not.toContain("leak-me-not");
    }
  });
});

describe("buildPoolConfig", () => {
  it("uses small serverless defaults on Vercel", () => {
    expect(buildPoolConfig({ VERCEL: "1" }).max).toBe(5);
    expect(buildPoolConfig({}).max).toBe(10);
  });

  it("honours env overrides and ignores malformed values", () => {
    const cfg = buildPoolConfig({ DB_POOL_MAX: "3", DB_POOL_IDLE_TIMEOUT_MS: "abc" });
    expect(cfg.max).toBe(3);
    expect(cfg.idleTimeoutMillis).toBe(30_000);
    expect(cfg.connectionTimeoutMillis).toBe(10_000);
  });
});

describe("requiresDistributedBackend waiver", () => {
  it("honours ALLOW_IN_MEMORY_STATE in production", async () => {
    const { requiresDistributedBackend } = await import("@/lib/api/request-guards");
    const saved = { ...process.env };
    try {
      Object.assign(process.env, { NODE_ENV: "production" });
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.ALLOW_IN_MEMORY_STATE;
      expect(requiresDistributedBackend()).toBe(true);
      process.env.ALLOW_IN_MEMORY_STATE = "true";
      expect(requiresDistributedBackend()).toBe(false);
    } finally {
      process.env = saved;
    }
  });
});
