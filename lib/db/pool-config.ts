/**
 * Pure builder for the pg pool bounds (AUDIT P1-2). Kept separate from
 * `prisma.ts` so it can be unit tested without a database or `server-only`.
 *
 * Defaults are serverless-safe: `max` is 5 on Vercel (total connections are
 * instances x max; PgBouncer does the fan-in) and 10 for the long-lived worker.
 * A malformed env value falls back to the default, never NaN.
 */
type Env = Record<string, string | undefined>;

export function positiveIntFromEnv(env: Env, name: string, fallback: number): number {
  const raw = env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function buildPoolConfig(env: Env) {
  const isServerless = Boolean(env.VERCEL);
  return {
    connectionString: env.DATABASE_URL,
    max: positiveIntFromEnv(env, "DB_POOL_MAX", isServerless ? 5 : 10),
    idleTimeoutMillis: positiveIntFromEnv(env, "DB_POOL_IDLE_TIMEOUT_MS", 30_000),
    connectionTimeoutMillis: positiveIntFromEnv(env, "DB_POOL_CONNECTION_TIMEOUT_MS", 10_000),
    statement_timeout: positiveIntFromEnv(env, "DB_STATEMENT_TIMEOUT_MS", 10_000),
    application_name: env.DB_APPLICATION_NAME ?? "spice-and-saffron",
    maxUses: positiveIntFromEnv(env, "DB_POOL_MAX_USES", 7_500),
  };
}
