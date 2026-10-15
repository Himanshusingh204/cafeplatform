# ADR-0006: Idempotency persisted and payload-bound, not in memory

| Field | Value |
| :--- | :--- |
| **Status** | Accepted |
| **Date** | 2026-10-15 |
| **Deciders** | Himanshu |
| **Supersedes** | _(none)_ |
| **Related** | [ADR-0002](./0002-redis-as-required-production-dependency.md), [ADR-0004](./0004-tenant-isolation-not-null-and-rls.md), [ADR-0005](./0005-decimal-money-and-integer-minor-units.md) |

## Context

Idempotency is implemented in `lib/resilience/idempotency.ts` and applied to
mutating requests by `server/middleware/idempotency.ts`. It has two structural
weaknesses:

1. **Records live in a process `Map`.** `IdempotencyManager` keeps records in a
   module-level `Map` (`lib/resilience/idempotency.ts:19`) and only uses Upstash
   when credentials are present (`lib/resilience/idempotency.ts:31-33`). On a
   multi-instance or serverless deployment, a duplicate request routed to a
   different instance is **not recognised** and is executed twice (see
   [ADR-0002](./0002-redis-as-required-production-dependency.md)).
2. **The key is not bound to the payload.** `acquire` takes only the key
   (`lib/resilience/idempotency.ts:54`). The middleware extracts the key from the
   `Idempotency-Key`/`X-Idempotency-Key` header
   (`server/middleware/idempotency.ts:12-13`) and passes it straight through.
   Because nothing hashes the request body, **reusing the same key with a
   different body silently replays the first response** instead of signalling a
   conflict — a client retrying an unrelated request with a stale key gets the
   wrong answer, with no error.

A third gap compounds both: the `Order` model
(`prisma/schema.prisma:314-353`) has **no persisted idempotency-key column**, so
even the correct response cannot be tied to the key at the database layer. Replay
safety therefore does **not survive a cache flush or a Redis outage** — the worst
time to lose it.

## Decision

Idempotency records are **persisted**, and the key is **bound to both the request
payload and the tenant**.

- **Storage:** idempotency records are stored in Redis (the production dependency
  from [ADR-0002](./0002-redis-as-required-production-dependency.md)) with a
  **database backstop**, so a Redis flush or outage cannot cause a duplicate
  charge or duplicate order. In-memory storage remains only for local development
  and tests.
- **Key binding:** the idempotency key is combined with a hash of the request
  **payload** and the resolved **tenant** (`tenantId` from
  [ADR-0004](./0004-tenant-isolation-not-null-and-rls.md)). The stored record
  captures the fingerprint it was created for.
- **Conflict semantics:** if the same key is reused with a **different body**, the
  server returns **`409 Conflict`**. A genuine replay of the identical request
  returns the original stored response; a concurrent in-flight duplicate returns
  the existing `409` "in-flight" response.
- **Persistence in the domain model:** `Order` gains a persisted idempotency-key
  column (tenant-scoped unique) so replay safety survives independently of the
  cache.

**Not yet implemented:** the payload/tenant binding, the `409` on body change,
the database backstop, and the `Order` idempotency column are the target for the
Phase 1 (correctness) and Phase 3 (Stateless runtime) work in
[`../ROADMAP.md`](../ROADMAP.md). Code today matches the defects described above.

## Consequences

### Positive

- Duplicate submissions — double-taps, client retries, network replays — are
  **safe across every instance**, not just within one warm process.
- Reusing a key with a different body fails loudly (`409`) instead of silently
  returning the wrong response, which is a real correctness and support-saving
  fix.
- Binding to the tenant prevents a key from one tenant colliding with or
  replaying into another.
- The database backstop means replay safety survives the failure modes (cache
  flush, Redis blip) where it is most needed.

### Negative

- Every idempotent write now incurs the cost of hashing the body and persisting a
  record to two stores.
- A database backstop adds write load and a retention/cleanup concern.
- The `409`-on-body-change behaviour is a **contract change** for clients that
  previously relied on silent replay; consumers must handle `409`.

### Neutral

- The wire interface is unchanged: clients still send `Idempotency-Key`. Only the
  server-side meaning of a reused key with a new body changes.
- The existing `AcquireResult` states (`acquired`, `in_flight`, `completed`) are
  sufficient; a conflict state is added.

## Alternatives considered

- **Keep the process `Map`.** Rejected: it is the current defect. It cannot
  deduplicate across instances and loses records on restart.
- **Redis-only, no database backstop.** Rejected: replay safety would vanish on a
  cache flush or Redis outage, exactly when duplicate protection matters most.
- **Key-only idempotency (no payload binding).** Rejected: it is the current
  defect — the same key with a different body silently replays the first
  response.
- **Require clients to generate globally unique keys and disallow reuse.**
  Rejected: it cannot be enforced and does not protect against client retry bugs;
  the server must detect misuse.

## References

- `lib/resilience/idempotency.ts` (memory `Map` at line 19; Redis switch at lines
  31-33; `acquire(key)` at line 54; `complete` at line 122)
- `server/middleware/idempotency.ts` (header extraction at lines 12-13; replay at
  lines 25-36; in-flight `409` at lines 38-45)
- `prisma/schema.prisma` (`Order` model, lines 314-353 — no idempotency column)
- [`../ROADMAP.md`](../ROADMAP.md), [`../TESTING.md`](../TESTING.md)
- [`../adr/README.md`](./README.md)
