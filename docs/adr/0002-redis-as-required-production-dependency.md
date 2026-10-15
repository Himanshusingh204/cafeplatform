# ADR-0002: Redis as a required production dependency

| Field | Value |
| :--- | :--- |
| **Status** | Accepted |
| **Date** | 2026-10-15 |
| **Deciders** | Himanshu |
| **Supersedes** | _(none)_ |
| **Related** | [ADR-0003](./0003-durable-outbox-job-queue.md), [ADR-0006](./0006-idempotency-persisted-not-in-memory.md) |

## Context

Four cross-cutting concerns currently degrade silently to **per-process
in-memory state** when Redis is not configured:

- **Cache** — `lib/cache/cache-manager.ts` stores entries in a module-level
  `Map` (`lib/cache/cache-manager.ts:11`) and only uses Upstash when
  `UPSTASH_REDIS_REST_URL`/`_TOKEN` are present (`lib/cache/cache-manager.ts:23-25`).
- **Idempotency** — `lib/resilience/idempotency.ts` keeps records in a
  process `Map` (`lib/resilience/idempotency.ts:19`) with the same
  Upstash-or-memory switch (`lib/resilience/idempotency.ts:31-33`).
- **Rate limiting** — `lib/rate-limit/limiter.ts` is memory-only when Redis is
  absent (`lib/rate-limit/limiter.ts:12`, `lib/rate-limit/limiter.ts:85-98`);
  its own comment notes the in-memory fallback is "per-instance only".
- **Pub/sub** — the real-time bus is an in-process `EventEmitter`.

On a multi-instance or serverless deployment — which is exactly what
[ADR-0001](./0001-vnext-route-handlers-as-primary-api.md) chooses — each
instance holds its **own** copy of this state. The consequences are concrete:

- Rate limits effectively **multiply by the instance count**, so an attacker (or
  a retry storm) can exceed the intended limit as many times as there are warm
  instances.
- Caches **diverge**: two instances can serve different menus for the same key,
  and a cache invalidation on one instance does not reach the others.
- Idempotency records are **not shared**, so a duplicate request routed to a
  different instance is not recognised (see
  [ADR-0006](./0006-idempotency-persisted-not-in-memory.md)).
- Realtime events emitted on one instance are invisible to SSE clients connected
  to another.

Today `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are documented as
**optional** in [`.env.example`](../../.env.example) ("recommended for
production"). That framing is the root cause: production has been allowed to boot
in a configuration that is not correct.

## Decision

**Redis (Upstash-compatible REST) becomes a REQUIRED production dependency**, used
for cache, rate limiting, idempotency and pub/sub.

- **Production boot must assert Redis configuration and fail fast** if it is
  missing. A production process deployed without Redis credentials should refuse
  to start rather than run in a degraded, silently incorrect mode.
- **In-memory implementations are retained strictly for local development and
  tests.** They are a development convenience, not a supported production
  fallback.
- **Runtime degradation rule (Redis configured but temporarily unreachable):**
  1. **Bypass the cache** — serve the correct value by computing it, and log
     loudly. Correct but slower.
  2. **Fall back to a local rate limit** — apply a per-instance limit rather than
     no limit, and log loudly.
  3. **Never fail a customer order because the cache or rate limiter is down.**
     Availability of the ordering path takes precedence over optimisation.
- The configuration contract is enforced in the environment template and in the
  Phase 3 (Stateless runtime) exit criteria in
  [`../ROADMAP.md`](../ROADMAP.md).

## Consequences

### Positive

- Rate limits, caches, idempotency keys and pub/sub become **globally consistent
  across instances**, which is the precondition for horizontal scale.
- A misconfigured production deployment fails immediately and loudly at boot
  instead of degrading silently over weeks.
- The degradation rule gives a clear, testable behaviour under partial failure:
  correctness is preserved, only performance is sacrificed.
- Removes a class of "works on one instance, breaks with two" incidents.

### Negative

- A new **hard external dependency** and operational surface: Redis availability,
  credentials, quota and latency now affect production.
- Upstash is a **paid/managed** service at production volume, adding recurring
  cost.
- Local development must still exercise the in-memory path, so tests must cover
  both the Redis-backed and memory-backed implementations.

### Neutral

- The public interfaces of `CacheManager`, `IdempotencyManager` and `rateLimit`
  are unchanged; only the production configuration requirement changes.
- Upstash's REST API keeps the platform compatible with serverless/edge runtimes
  where a raw TCP Redis client would not be.

## Alternatives considered

- **Keep Redis optional and rely on sticky sessions / a single instance.**
  Rejected: it caps scale at one instance, contradicts the serverless target of
  [ADR-0001](./0001-vnext-route-handlers-as-primary-api.md), and still loses all
  state on every deploy.
- **Ship an in-memory-only production mode.** Rejected: it is the current defect.
  Per-instance rate limits and divergent caches are not acceptable in production.
- **Self-hosted Redis in a container.** Rejected for the managed target: it
  reintroduces the always-on connection and host that serverless deployments
  avoid; Upstash's REST model fits the runtime. Self-hosters may still run
  standard Redis behind a REST proxy if they wish.
- **Use only the database for rate limiting and caching.** Rejected: it turns
  hot, high-frequency operations into database load and defeats the purpose of
  the cache layer.

## References

- `lib/cache/cache-manager.ts` (memory `Map` at line 11; Upstash switch at
  lines 23-25; get/set at lines 41-101)
- `lib/resilience/idempotency.ts` (memory `Map` at line 19; Upstash switch at
  lines 31-33)
- `lib/rate-limit/limiter.ts` (memory store at line 12; fallback at lines 85-98)
- `lib/realtime/bus.ts` (in-process event bus)
- [`.env.example`](../../.env.example) (Upstash variables currently labelled
  "recommended for production")
- [`../MASTER_PLAN.md`](../MASTER_PLAN.md), [`../ROADMAP.md`](../ROADMAP.md)
  (Phase 3 — Stateless runtime)
- [`../OPERATIONS.md`](../OPERATIONS.md)
- [`../adr/README.md`](./README.md)
