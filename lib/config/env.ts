import { z } from "zod";

/**
 * Boot-time configuration validation (AUDIT P0-2).
 *
 * Deliberately free of `server-only` so both the Next `register()` hook and the
 * Express entry can run it. Errors list variable NAMES only, never values.
 */

const present = z.string().trim().min(1);
const optional = z.string().optional();

const baseSchema = z.object({
  NODE_ENV: optional,
  DATABASE_URL: optional,
  AUTH_SECRET: optional,
  APP_URL: optional,
  UPSTASH_REDIS_REST_URL: optional,
  UPSTASH_REDIS_REST_TOKEN: optional,
  ALLOW_IN_MEMORY_STATE: optional,
});

const productionSchema = baseSchema.extend({
  DATABASE_URL: present,
  AUTH_SECRET: present,
  APP_URL: present,
});

export class ConfigError extends Error {
  readonly missing: string[];
  constructor(missing: string[]) {
    super(
      `Invalid server configuration. Missing or invalid environment variables: ${missing.join(", ")}`
    );
    this.name = "ConfigError";
    this.missing = missing;
  }
}

/** True when the operator explicitly accepted per-instance (non-shared) state. */
export function isInMemoryStateAllowed(env: Record<string, string | undefined> = process.env): boolean {
  return env.ALLOW_IN_MEMORY_STATE?.trim().toLowerCase() === "true";
}

/** Returns the names of missing/invalid variables for the given environment. */
export function findConfigProblems(env: Record<string, string | undefined>): string[] {
  if (env.NODE_ENV !== "production") return [];

  const problems = new Set<string>();
  const result = productionSchema.safeParse(env);
  if (!result.success) {
    for (const issue of result.error.issues) problems.add(String(issue.path[0]));
  }

  const hasRedis = Boolean(
    env.UPSTASH_REDIS_REST_URL?.trim() && env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
  if (!hasRedis && !isInMemoryStateAllowed(env)) {
    problems.add("UPSTASH_REDIS_REST_URL");
    problems.add("UPSTASH_REDIS_REST_TOKEN");
    problems.add("(or ALLOW_IN_MEMORY_STATE=true)");
  }

  return [...problems];
}

/** Throws one aggregated ConfigError when production config is incomplete. */
export function assertValidEnv(env: Record<string, string | undefined> = process.env): void {
  const problems = findConfigProblems(env);
  if (problems.length > 0) throw new ConfigError(problems);
}
