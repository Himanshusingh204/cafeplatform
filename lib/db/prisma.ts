import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { buildPoolConfig } from "@/lib/db/pool-config";
import { logger } from "@/lib/logger";

/**
 * Connection-pool bounds (AUDIT P1-2).
 *
 * PgBouncer in transaction mode sits in front of Postgres (DATABASE_URL is the
 * pooled URL). Per-instance pools stay deliberately small: total connections are
 * `instances × max`, and the pooler — not this pool — does the fan-in. A
 * serverless cold start must not be able to open a full 10-connection pool, so
 * `max` defaults to 5 on Vercel and 10 for the long-lived Node worker.
 *
 * `statement_timeout` is a server-side guard (the query is cancelled), while
 * `connectionTimeoutMillis` fails fast instead of pinning a request on a
 * saturated pool. Both are part of `pg`'s ClientConfig, which
 * `@prisma/adapter-pg` forwards verbatim when given a PoolConfig.
 */
function createAdapter() {
  return new PrismaPg(
    buildPoolConfig(process.env),
    {
      onPoolError: (err: Error) => {
        logger.error({ event: "db.pool_error", message: err.message });
      },
    }
  );
}

function createClient() {
  const adapter = createAdapter();
  const base = new PrismaClient({ adapter });

  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const start = performance.now();
          const result = await query(args);
          const duration = Math.round(performance.now() - start);
          if (duration > 150) {
            logger.warn({
              event: "db.slow_query",
              model,
              operation,
              durationMs: duration,
            });
          }
          return result;
        },
      },
    },
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
