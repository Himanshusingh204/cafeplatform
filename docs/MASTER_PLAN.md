# Engineering Master Plan

**Project:** Spice & Saffron — Indian Fine Dining & Café Platform
**Owner:** Himanshu ([@Himanshusingh204](https://github.com/Himanshusingh204))
**Document status:** Living plan — reviewed at the start of every phase
**Last updated:** 2026-10-15

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Where the system is today](#2-where-the-system-is-today)
3. [North-star principles](#3-north-star-principles)
4. [Target architecture](#4-target-architecture)
5. [Scale and capacity model](#5-scale-and-capacity-model)
6. [Domain decomposition](#6-domain-decomposition)
7. [Cross-cutting concerns](#7-cross-cutting-concerns)
8. [Networking and edge design](#8-networking-and-edge-design)
9. [Data layer and indexing strategy](#9-data-layer-and-indexing-strategy)
10. [Reliability, SLOs and failure modes](#10-reliability-slos-and-failure-modes)
11. [Security model](#11-security-model)
12. [Observability](#12-observability)
13. [Testing strategy](#13-testing-strategy)
14. [SEO and performance budget](#14-seo-and-performance-budget)
15. [Delivery roadmap](#15-delivery-roadmap)
16. [Risk register](#16-risk-register)
17. [Definition of done](#17-definition-of-done)

---

## 1. Executive summary

Spice & Saffron is a **multi-tenant restaurant commerce and operations
platform**: a customer-facing storefront (menu, ordering, reservations,
loyalty, waitlist) plus an operations back office (kitchen display, floor plan,
inventory, dispatch, CMS) delivered as one Next.js 16 application, with an
optional standalone API process for long-lived workloads.

The codebase is already unusually capable for its age: 26 domain models,
Argon2id + hashed sessions, scoped S2S keys, HMAC-verified payment webhooks,
RBAC, an audit trail, a cache-aside layer, an idempotency engine, a job queue
and live SSE kitchen tickets — with 148 tests passing, a clean typecheck and a
clean lint.

**But it is not yet production-ready for scale, and the gap is almost entirely
in four places:**

| # | Gap | Why it blocks production |
| :-- | :--- | :--- |
| 1 | **State lives in process memory** — the event bus, job queue, cache fallback and rate limiter are `new Map()` / `EventEmitter` singletons | On serverless or with more than one instance, kitchen tickets, emails, webhooks and rate limits silently break or diverge per instance |
| 2 | **The API surface cannot deploy as designed** — `vercel.json` deploys Next.js, but the architecture promises an Express service on port `4000` | The B2B/KDS API is dead in production on Vercel. (The upload `data:`-URL corruption that accompanied this was fixed in Phase 1.) |
| 3 | **The database is under-indexed for its own queries and the tenant filter is an `OR`** | Slow queries already appear at build time (`Dish.findMany` at 195 ms); tenant `null`-fallback is both a performance and an isolation hazard |
| 4 | **Content weight defeats the Lighthouse goal** — shipped images are 0.95–2.9 MB each, and the hero image is the LCP element | No amount of code tuning reaches 100 Performance with a 951 KB LCP image |

This plan closes all four, then hardens, tests, documents and optimises the
platform to a deployable commercial standard.

**Recommended strategy — "one codebase, two runtimes":**

- **Vercel (or any Node host) runs Next.js as the primary API**, via Route
  Handlers under `app/api/v1/*` that are thin adapters over the same
  `lib/services/*` used by Server Actions. This is the production path.
- **The standalone Express server is retained** for self-hosting, for
  long-running workers, and for local development — reusing the identical
  service layer so the two runtimes can never drift.
- **Redis becomes a hard production dependency** (cache, rate limit,
  idempotency, pub/sub) with in-memory implementations kept strictly for local
  development and tests.

The work is sequenced into ten phases in
[`ROADMAP.md`](./ROADMAP.md), ordered so that **correctness and deployability
come before optimisation**, and each phase ships independently.

---

## 2. Where the system is today

### 2.1 Verified state (measured, not assumed)

| Check | Command | Result |
| :--- | :--- | :--- |
| TypeScript | `npx tsc --noEmit` | ✅ Clean — 0 errors |
| ESLint | `npm run lint` | ✅ Clean — 0 warnings |
| Unit / integration / security | `npx vitest run` | ✅ **148 passed / 27 files** (~57 s, serial) |
| Production build | `npm run build` | ✅ Succeeds — 40 routes, 1 warning |
| Build warning | — | ✅ Resolved 2026-10-15 — the `@vercel/blob` import was removed in Phase 1 |
| Build telemetry | — | ⚠️ `db.slow_query` — `Dish.findMany` at **195 ms** |
| Dependency audit | `npm audit` | Weekly in CI at `--audit-level=critical` (too lax) |

### 2.2 Runtime topology as built

```
Browser ──▶ Next.js 16 (3000)          ──▶ Prisma ──▶ PostgreSQL
   │            │  ├─ RSC / ISR pages
   │            │  ├─ Server Actions (admin RBAC)
   │            │  └─ Route Handlers: /api/v1/*, /api/health, /api/upload
   │            │
   │            └── in-process singletons: EventBus, JobQueue, memory cache,
   │                memory rate-limit store
   │
POS / aggregator ──▶ Express (4000, server/api.ts) ──▶ Prisma ──▶ PostgreSQL
                          ├─ /api/v1/menu, /orders, /coupons/validate
                          ├─ /api/v1/realtime/kds (SSE)
                          └─ /api/v1/webhooks/payment, /system/metrics
```

**Critical observation:** two runtimes both own a copy of the in-memory
singletons. A kitchen ticket created through Next.js is **invisible** to an SSE
listener attached to the Express process. This is invisible locally (each
runtime is exercised alone) and breaks the moment both are deployed.

### 2.3 What is already strong — do not regress

- Argon2id passwords; SHA-256-hashed session tokens; `HttpOnly` / `SameSite` /
  `Secure` cookies.
- Constant-time comparison for API keys and webhook signatures.
- Server-side authoritative pricing; explicit anti-tampering tests.
- Scoped S2S keys (`sp_live_…`) with a revocation path.
- Idempotent, HMAC-verified payment webhook ingress.
- Zod validation at the boundary; Prisma parameterisation throughout.
- A single Prisma client with slow-query telemetry.
- RBAC with a permission matrix and an immutable audit log.
- SEO baseline: metadata, Open Graph, Twitter cards, `Restaurant` JSON-LD,
  `robots.txt`, dynamic `sitemap.xml`.
- Security headers and a real CSP in `next.config.ts`.
- CI with a Postgres service, migrations, seed, lint, typecheck, tests, build,
  and a separate Playwright job on desktop Chromium **and** mobile Chrome.

---

## 3. North-star principles

These decide every trade-off in this plan. When two options tie, the earlier
principle wins.

1. **Deployability before elegance.** A feature that cannot be deployed is worth
   nothing. Every phase leaves `main` releasable.
2. **No correctness in process memory.** Cache, rate limit, idempotency, queue
   and pub/sub must be backed by a shared store in production. Memory is a
   local-development optimisation, never a production guarantee.
3. **One source of truth per rule.** Business rules live once, in
   `lib/services/*`. Adapters (Route Handlers, Server Actions, Express) are
   thin and contain no domain logic.
4. **Fail closed.** An unresolvable tenant, an unverifiable signature, a missing
   price, an absent permission → deny. Never guess, never fall back silently.
5. **Index for the query, not for the column.** Every index must be traceable
   to a named query pattern; every unused index is a write-tax and gets dropped.
6. **Money is never a float.** `Decimal(10,2)` with an explicit currency, always.
7. **Measure before optimising.** No performance claim ships without a
   Lighthouse/LoadForge/k6 number or an `EXPLAIN ANALYZE` plan attached.
8. **Idempotent by default.** Network is unreliable; every retryable mutation
   must be safe to replay.
9. **Config over hardcoding — humanise, then externalise.** No magic numbers in
   components, no duplicated address/phone/hours, no brand strings scattered in
   JSX. One typed config module per concern.
10. **Optimise the bytes a customer actually downloads.** The fastest code is
    code and content you never send.

---

## 4. Target architecture

### 4.1 Layered model

```
┌─────────────────────────────────────────────────────────────────────────┐
│ L0  EDGE         Vercel Edge / CDN · TLS · HSTS · WAF · ISR cache       │
├─────────────────────────────────────────────────────────────────────────┤
│ L1  PRESENTATION Next.js 16 App Router                                  │
│                  RSC + PPR · ISR/SSG marketing · Server Actions         │
│                  Route Handlers = API adapters (production API path)    │
│                  proxy.ts = cheap auth gate (never the only guard)       │
├─────────────────────────────────────────────────────────────────────────┤
│ L2  APPLICATION  Server Actions · Route Handlers · lib/api (envelope)   │
│                  Zod validation · auth/authorisation · rate limit       │
├─────────────────────────────────────────────────────────────────────────┤
│ L3  DOMAIN       lib/services/*  — pure business rules, transactionally  │
│                  correct, framework-free, unit-tested                   │
├─────────────────────────────────────────────────────────────────────────┤
│ L4  INFRASTRUCTURE                                                      │
│      lib/db (Prisma + pool + telemetry)   lib/cache (Redis)             │
│      lib/realtime (pub/sub)               lib/queue (durable outbox)    │
│      lib/resilience (idempotency)         lib/payments · lib/email      │
│      lib/auth (session, RBAC, S2S)        lib/logger, lib/telemetry     │
├─────────────────────────────────────────────────────────────────────────┤
│ L5  DATA         PostgreSQL (primary + read replica) · Redis · Blob/S3  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Two-runtime contract

The Express server and the Next.js Route Handlers are **two adapters over one
domain layer**. Neither may contain business logic.

```
                    ┌───────────────────────────┐
                    │   lib/services/*          │  ← the only business logic
                    │   (pure, tested)          │
                    └────────────┬──────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              ▼                                     ▼
  ┌───────────────────────────┐        ┌───────────────────────────┐
  │ app/api/v1/*  (production)│        │ server/api.ts (self-host) │
  │ Next Route Handlers       │        │ Express, long-lived       │
  └───────────────────────────┘        └───────────────────────────┘
```

A **contract test** asserts that both adapters return byte-compatible payloads
for the same input. If they diverge, CI fails. This is what makes "one codebase,
two runtimes" safe rather than aspirational.

### 4.3 Runtime placement matrix

| Workload | Runtime | Reason |
| :--- | :--- | :--- |
| Public pages (menu, about, gallery) | Vercel, static/ISR | CDN-served, cheapest, fastest |
| Checkout, order tracker, reservations | Vercel, Node serverless | Dynamic, request-scoped |
| Admin CMS + Server Actions | Vercel, Node serverless | RBAC, short transactions |
| `app/api/v1/*` B2B API | Vercel, Node serverless | Same domain layer as the app |
| Payment webhook ingress | Vercel, Node serverless | Must answer fast, then enqueue |
| **SSE `/realtime/kds`** | Vercel streaming **or** Express | Needs a live connection; Redis pub/sub makes either correct |
| **Background jobs** (email, webhooks, KDS fan-out) | **Worker process** + Vercel Cron | Serverless cannot host an `setInterval` worker reliably |
| **Scheduled jobs** (86-reset, nightly rollups, backups) | Vercel Cron / host cron | Deterministic scheduling |

**Decision:** SSE is served from a Route Handler with `runtime = "nodejs"` and a
Redis pub/sub subscription, so it is correct on Vercel **and** on the Express
server. Background work moves to a **durable, database-backed outbox** drained
by a worker, because a serverless instance is frozen between requests and will
never reliably run a timer-based worker.

---

## 5. Scale and capacity model

### 5.1 Design targets

| Dimension | Target | Notes |
| :--- | :--- | :--- |
| Public read traffic (cached) | **5M page views / month**, 10k concurrent bursts | Served from CDN/ISR; origin sees a fraction |
| Storefront TTFB (p95, cached) | **< 200 ms** | Edge-cached HTML |
| Storefront TTFB (p95, uncached) | **< 600 ms** | Node function + one Redis round trip |
| API p95 latency (read) | **< 250 ms** | Includes cache miss |
| API p95 latency (write) | **< 500 ms** | Commit + enqueue only; side effects are async |
| Peak write throughput | **200 orders / minute** per tenant | ~3.3 writes/s sustained, 20/s burst |
| Concurrent KDS screens | **50 per tenant** | Fan-out via pub/sub, one Redis message per event |
| Tenants (restaurants) | **100+** on shared infrastructure | Logical isolation + optional RLS |
| Data retention | Orders 7 years, audit 7 years, logs 30–90 days | Compliance-aware defaults |

### 5.2 Why the current design does not meet these

| Component | Limit today | Effect at scale |
| :--- | :--- | :--- |
| `lib/rate-limit/limiter.ts` memory store | Per-instance | N instances ⇒ N× the intended limit; no real protection |
| `lib/cache/cache-manager.ts` memory Map | Per-instance; capped 5 000 entries | Cache hit rate collapses to ~1/N; stale per instance |
| `lib/queue/job-queue.ts` | In-process `setInterval` | Jobs lost on deploy; never drained if frozen |
| `lib/realtime/bus.ts` | `EventEmitter` | Kitchen screens see only their own instance's events |
| `lib/db/prisma.ts` `PrismaPg` | Default pool per instance | Serverless × pool size ⇒ Postgres `max_connections` exhaustion |
| Images 0.95–2.9 MB, no CDN transform | Original bytes to the browser | LCP and bandwidth blowout |

### 5.3 Scaling levers, in order of use

1. **Cache harder** — ISR/PPR for public pages, Redis cache-aside for hot API
   reads, `stale-while-revalidate` at the edge.
2. **Make the app tier stateless** — no local state that matters (Phase 3).
3. **Offload writes** — commit, then enqueue; side effects never block a response.
4. **Pool connections properly** — `PgBouncer`/Neon pooler in transaction mode,
   small per-instance pool (`max ≈ 1–5` for serverless), `max ≈ 10–20` for a
   long-lived worker.
5. **Add a read replica** — route reporting, dashboards, sitemap and analytics
   reads to the replica.
6. **Shard by tenant** — only if read replicas and caching are exhausted;
   `tenantId` is already the natural shard key.
7. **Vertical first, then horizontal** — for Postgres, the biggest instance
   beats premature sharding.

---

## 6. Domain decomposition

Bounded contexts, each owning its rules and its tables:

| Context | Responsibilities | Key models | Service module |
| :--- | :--- | :--- | :--- |
| **Identity** | Admin auth, sessions, RBAC, S2S keys | `Admin`, `Session`, `ApiKey` | `lib/auth/*` |
| **Tenancy** | Tenant lifecycle, resolution, isolation, plan limits | `Tenant` | `lib/db/tenant.ts` |
| **Catalog** | Categories, dishes, modifiers, availability | `Category`, `Dish`, `DishModifier*` | `lib/services/menu.ts` |
| **Ordering** | Cart authority, pricing, coupons, order lifecycle | `Order`, `OrderItem`, `OrderItemModifier`, `Coupon` | `lib/services/orders.ts` |
| **Payments** | Gateway abstraction, capture, refund, webhooks | *(fields on `Order`)* | `lib/payments/engine.ts` |
| **Dining room** | Reservations, tables, floor plan, waitlist | `Reservation`, `DiningTable`, `WaitlistEntry` | `lib/services/tables.ts`, `reservations.ts`, `waitlist.ts` |
| **Kitchen** | Stations, tickets, bumping, chit printing | `OrderItem.station` | `lib/services/orders.ts`, `lib/realtime/*` |
| **Inventory** | Ingredients, recipes, stock, auto-86 | `Ingredient`, `RecipeItem` | `lib/services/inventory.ts` |
| **Loyalty** | Customers, points ledger, tiers | `CustomerUser`, `LoyaltyLedger` | `lib/services/loyalty.ts` |
| **Content** | Gallery, reviews, settings, pages | `GalleryImage`, `Review`, `Setting` | `lib/services/gallery.ts`, `reviews.ts`, `settings.ts` |
| **Messaging** | Contact inquiries, notifications | `ContactMessage` | `lib/services/messages.ts` |
| **Integration** | Outbound webhooks, delivery aggregators | `WebhookSubscription`, `WebhookDelivery` | `lib/webhooks/dispatcher.ts` |
| **Operations** | Audit, metrics, dashboards | `ActivityLog` | `lib/services/audit.ts`, `dashboard.ts` |

**Rule:** contexts communicate through service calls or domain events — never by
reaching into another context's tables.

---

## 7. Cross-cutting concerns

| Concern | Approach |
| :--- | :--- |
| **Configuration** | One typed module per concern in `config/`. No magic numbers or duplicated brand strings. `config/site.ts` is the single source for name, address, phone, hours, socials — the JSON-LD in `app/layout.tsx` must read from it, not restate it. |
| **Validation** | Zod at every trust boundary (HTTP body, query, params, webhook payload, form). Parse, don't cast. |
| **Errors** | One `AppError` taxonomy (validation / auth / not-found / conflict / rate-limit / upstream) mapped to HTTP status codes in `lib/api/response.ts`. Never leak stack traces to clients. |
| **Logging** | Structured JSON through `lib/logger.ts`, always carrying `requestId`, `tenantId`, `route`, `durationMs`, `outcome`. Never log secrets or raw PII. |
| **Time** | Store UTC (`timestamptz`); render in the tenant's timezone. All "today"/"open now" logic must be timezone-explicit and injectable for tests. |
| **Money** | `Decimal(10,2)` + `currency` column. Round-half-up once, at the total. Never float arithmetic. |
| **IDs** | UUIDv4 for internal keys; human-readable codes for customer-facing references (`orderNumber`, `referenceCode`) with uniqueness guaranteed by the database, not by retry luck. |
| **Feature flags** | A `Setting`-backed flag store so risky rollouts can be disabled without a deploy. |
| **Pagination** | Cursor-based for order/message/activity lists. Offset pagination is banned on large tables. |

---

## 8. Networking and edge design

### 8.1 Request lifecycle (storefront page)

```
Client
  │ HTTPS (TLS 1.2+/1.3, HTTP/2)
  ▼
CDN / Edge  ── HSTS, security headers, bot mitigation, rate limit (edge)
  │
  ▼
Next.js  ── ISR/PPR cache hit? ── yes ──▶ return HTML from cache (≈10–40 ms)
  │ no
  ▼
RSC render ──▶ lib/services ──▶ Redis cache-aside ── hit? ──▶ render
  │ miss
  ▼
Prisma (pooled) ──▶ PostgreSQL
  │
  ▼
HTML streamed to client; ISR cache revalidated (tag-based)
```

### 8.2 Order write path (the money path)

```
POST /api/v1/orders  or  Server Action
  1. Rate limit (Redis, per IP + per key)
  2. Idempotency check (Redis key, unique per Idempotency-Key)
  3. Zod parse
  4. S2S key verify (if B2B) — constant time, scoped
  5. lib/services/orders.createOrder()
       ├─ BEGIN TRANSACTION
       │    ├─ re-read authoritative prices from DB
       │    ├─ validate coupon server-side
       │    ├─ validate loyalty redemption
       │    ├─ decrement inventory / verify ingredient availability
       │    ├─ INSERT Order + OrderItems (+ modifiers)
       │    ├─ INSERT LoyaltyLedger
       │    └─ INSERT outbox events (kds, email, webhook)
       └─ COMMIT
  6. Return 201 with order payload (+ idempotency result cached)
  7. Out-of-band: worker drains outbox → KDS broadcast, email, webhook
```

**Invariant:** step 5 is the only place prices are decided. Steps 1–4 are
admission control; step 6 must never be blocked by step 7.

### 8.3 Network-level controls

| Control | Setting |
| :--- | :--- |
| TLS | Enforce HTTPS; HSTS `max-age=63072000; includeSubDomains; preload` |
| Security headers | CSP (already present, tighten in Phase 8), `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` |
| CORS | **Strict allowlist** in production. The Express server currently returns `true` for every origin with `credentials: true` (`server/api.ts:35`) — must be fixed in Phase 4 |
| Timeouts | Gateway calls 10 s; DB statement 5 s; whole route 30 s |
| Retries | Idempotent GETs only, exponential backoff **with jitter**, capped at 3; never blind-retry a mutation |
| Circuit breaking | Per-dependency breaker for payment gateways and email |
| Backpressure | Bounded queue depth; shed load with `429` + `Retry-After` rather than collapsing |
| SSE | `Cache-Control: no-cache, no-transform`, 25 s heartbeat, `X-Accel-Buffering: no`, explicit connection cap per tenant |
| Webhook egress | HMAC-SHA256 signature, timestamp, event id, 3 attempts with backoff, then the dead-letter queue |
| Compression | Brotli/gzip at the edge; pre-compressed static assets |
| Keep-alive | HTTP keep-alive to Postgres via the pooler; avoid per-request TCP + TLS handshakes |

---

## 9. Data layer and indexing strategy

Full detail — including the exact DDL to add and drop, and the pool/prepared-
statement reasoning — lives in [`DATABASE.md`](./DATABASE.md). Summary:

**Problems today**

1. **Tenant filters use `OR [{ tenantId }, { tenantId: null }]`** on every
   tenant-scoped read. This defeats index seeks and, worse, means a request for
   a non-existent tenant silently receives the **default tenant's** data
   (`lib/db/tenant.ts:63–65`). Fix: backfill `tenantId`, make it `NOT NULL`,
   and **404 on unknown tenant**.
2. **Composite indexes are missing for real query shapes.** The menu query is
   `WHERE categoryId = ? AND isAvailable = true AND deletedAt IS NULL ORDER BY
   sortOrder` — the only existing index is on `categoryId` alone, so Postgres
   filters and sorts in memory. This is the 195 ms `Dish.findMany`.
3. **Redundant indexes** waste writes: `slug @unique` **plus** `@@index([slug])`
   on `Tenant`, `Category`, `Dish`, `Coupon`; `email @unique` **plus**
   `@@index([email])` on `Admin`; `keyHash @unique` **plus** `@@index([keyHash])`
   on `ApiKey`.
4. **Contexts missing `tenantId` entirely**: `GalleryImage`, `ContactMessage`,
   `Review`, `Setting` (and its `key` is globally unique), `Coupon`. These leak
   across tenants by construction.
5. **No cursor-friendly indexes** on the largest lists (`Order`, `ContactMessage`,
   `ActivityLog`, `LoyaltyLedger`).
6. **Denormalisation gaps**: `OrderItem.dishName` is denormalised (good);
   no `Order.customerEmail` index, so "my orders" lookups scan.

**Indexing rules to be applied**

- **Equality columns first, then range, then sort.** e.g.
  `(categoryId, isAvailable, deletedAt, sortOrder)`.
- **One composite beats several singles.** Drop the single-column index the
  composite's leftmost prefix already covers.
- **Partial indexes for soft deletes**: `WHERE deletedAt IS NULL` keeps the hot
  index small and always-hit.
- **Every index must name the query in a comment**, so dead indexes are findable.
- **Verify with `EXPLAIN (ANALYZE, BUFFERS)`** before and after; record the plan
  in the PR.
- **Write cost is real**: each index slows `INSERT`/`UPDATE`. Do not index
  `metadata Json` or free-text columns.

**Connection handling (`lib/db/prisma.ts`)**

Today: `new PrismaPg({ connectionString: process.env.DATABASE_URL })` — no pool
bounds, no statement timeout, and a fresh client per cold start. Target:
explicit `max` per runtime (1–5 serverless behind a pooler, 10–20 for the
worker), `idleTimeoutMillis`, `connectionTimeoutMillis`, `statement_timeout`,
`application_name` for observability, and `PreparedStatement` handling that is
safe under PgBouncer transaction pooling. A transaction helper adds bounded
retries for serialization failures. Details in [`DATABASE.md`](./DATABASE.md).

---

## 10. Reliability, SLOs and failure modes

### 10.1 Service level objectives

| SLO | Target | Measured by |
| :--- | :--- | :--- |
| Availability (storefront) | **99.9 %** monthly | Synthetic checks + edge analytics |
| Availability (admin API) | **99.5 %** monthly | Route-handler error rate |
| Storefront TTFB p95 | **< 200 ms** cached | RUM + Lighthouse |
| API latency p95 | **< 250 ms** read, **< 500 ms** write | Structured logs |
| Error rate (5xx) | **< 0.5 %** of requests | Log aggregation |
| Payment webhook success | **> 99.5 %** within 5 min | Ledger vs. gateway report |
| Job queue lag p95 | **< 60 s** | Outbox depth metric |
| Data durability | **RPO ≤ 5 min**, **RTO ≤ 1 h** | Restore drill (quarterly) |

### 10.2 Failure modes and required behaviour

| Failure | Required behaviour |
| :--- | :--- |
| Redis unavailable | Degrade: bypass cache (correct, slower), fall back to a **local** rate limit and log loudly. Never fail an order because the cache is down. |
| Payment gateway timeout | Do not mark paid. Keep `PENDING`, surface "confirming", reconcile via webhook/poll. Never double-charge on retry. |
| Webhook duplicate delivery | Idempotency key short-circuits; second delivery returns `200` with no state change. |
| Job handler permanently failing | Exponential backoff, then dead-letter with the full payload retained and a replay path. |
| Postgres primary failover | Pooler retries; requests return `503` with `Retry-After`; no partial writes (single transaction per order). |
| Deploy mid-flight | Graceful drain; in-flight requests finish; new instances are stateless so nothing is lost. |
| Kitchen screen disconnected | SSE reconnect with `Last-Event-ID`; client re-fetches current ticket state to resync. |
| Traffic spike | Edge rate limit + load shedding with `429`; caches absorb reads. |

### 10.3 Backup, restore and DR

- **Automated daily** full backup + **point-in-time recovery** (WAL) on the
  managed Postgres provider.
- **Quarterly restore drill**: restore to a scratch database, run migrations,
  verify row counts and a smoke suite. A backup that has never been restored is
  not a backup.
- **Redis is a cache**, never a system of record. Nothing critical may exist
  only in Redis.
- **Blob storage** versioned, with lifecycle rules on orphaned uploads.

---

## 11. Security model

Detailed controls and the responsible-disclosure process are in
[`SECURITY.md`](../SECURITY.md). The engineering plan adds:

| Area | Action |
| :--- | :--- |
| **CORS** | Replace the permissive Express callback with a strict allowlist derived from `APP_URL`; reject unknown origins on credentialed routes |
| **CSP** | Remove `'unsafe-inline'` for scripts where feasible; keep the nonce/`strict-dynamic` path as a target; document every exception |
| **Tenant isolation** | `tenantId NOT NULL`, composite indexes, and **Postgres RLS** policies as defence in depth |
| **Authorisation** | Every route/action asserts a permission; add tests that assert a lower role **cannot** reach a higher-role action |
| **Secrets** | Prefix-scoped (no `NEXT_PUBLIC_*` for anything sensitive), rotated on a schedule, scanned in CI (gitleaks) |
| **Uploads** | MIME + magic-byte sniffing, size cap, randomised keys, served from object storage — never a `data:` URL in the database |
| **Dependencies** | Raise `npm audit` to `--audit-level=high`; add Dependabot and a lockfile-integrity check |
| **Headers** | Add `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, `X-DNS-Prefetch-Control` |
| **Abuse** | Redis-backed limits on login, contact, order creation, coupon validation and S2S calls; per-tenant quotas |
| **PII** | Document which fields are personal data, minimise retention, support erasure requests, never log raw PII |

---

## 12. Observability

**Now (adequate for local):** structured JSON logs from `lib/logger.ts` plus
Prisma slow-query warnings.

**Target:**

| Pillar | Implementation |
| :--- | :--- |
| **Logs** | Structured JSON with `requestId`, `tenantId`, `route`, `durationMs`, `outcome`, `errorCode`. Shipped to a log platform (Axiom / Better Stack / Datadog). |
| **Metrics** | RED per route (Rate, Errors, Duration) + queue depth, outbox lag, cache hit ratio, pool saturation, SSE connections, failed webhooks. |
| **Tracing** | OpenTelemetry: HTTP span → service span → Prisma span → outbound span. `requestId` correlates logs to traces. |
| **Health** | `/api/health` (liveness) and a deeper readiness probe that checks DB **and** Redis, reporting degraded rather than dead when only the cache is down. |
| **Alerting** | 5xx rate, p95 latency, queue lag, pool exhaustion, webhook failure rate, failed logins, disk/connection saturation. |
| **Dashboards** | Ops dashboard (queue lag, error rate, latency), business dashboard (orders/hour, revenue, AOV, reservations). |

**Rule:** every alert must be actionable and must link to the runbook entry that
resolves it. Alerts that fire without an action get deleted.

---

## 13. Testing strategy

Full plan in [`TESTING.md`](./TESTING.md). Summary and the **gaps to close**:

| Layer | Today | Target |
| :--- | :--- | :--- |
| Unit | ✅ 17 files | Keep; add money, timezone and tier-boundary cases |
| Integration | ✅ 9 files | Add coverage for order lifecycle end-to-end, coupon edge cases, loyalty ledger integrity |
| Security | ✅ 2 files | Add IDOR on orders/reservations/loyalty, tenant-crossover, CORS, upload, SSRF, RLS bypass |
| **Express `server/api.ts`** | ❌ **untested** | Contract tests: same input ⇒ identical response from Route Handler and Express |
| **Concurrency / idempotency** | Partial | Parallel duplicate submissions must produce one order |
| **Load** | ❌ none | k6/autocannon: menu read, order write, SSE fan-out; publish p95 |
| **Accessibility** | ❌ none | `axe-core` in Playwright on every public page; zero critical violations |
| **Visual regression** | ❌ none | Playwright snapshots on key pages |
| **Coverage gate** | ❌ none | `@vitest/coverage-v8`; floor on `lib/services/**` and `lib/auth/**` |
| **Lighthouse CI** | ❌ none | Budget assertions on SEO/a11y/best-practices **and** performance |
| E2E | ✅ 2 specs, 2 viewports | Add checkout, tracking, loyalty, waitlist, inventory-86 flows |

CI additions: coverage gate, a11y gate, Lighthouse CI budget, contract tests,
`npm audit --audit-level=high`, gitleaks, and a nightly load-test job.

---

## 14. SEO and performance budget

Full plan in [`SEO-AND-PERFORMANCE.md`](./SEO-AND-PERFORMANCE.md).

### 14.1 The headline problem

Shipped image weights (verified):

| Asset | Size |
| :--- | :--- |
| `public/images/screenshots/05-gallery.png` | **2 862 KB** |
| `public/images/hero/hero-dining.jpg` | **951 KB** ← LCP element |
| `public/images/menu/chicken-biryani.jpg` | 960 KB |
| `public/images/about/chef-tandoor.jpg` | 965 KB |
| ten more gallery/menu images | 950–965 KB each |

A 951 KB LCP image makes a 100 Performance score mathematically impossible on
mobile. **The single highest-leverage performance action in this entire plan is
an image pipeline.**

### 14.2 Budget (enforced in CI)

| Metric | Budget |
| :--- | :--- |
| Lighthouse Performance (mobile) | **≥ 95**, target 100 |
| Lighthouse Accessibility | **100** |
| Lighthouse Best Practices | **100** |
| Lighthouse SEO | **100** |
| LCP (mobile, 4G) | **< 2.0 s** |
| CLS | **< 0.05** |
| INP | **< 200 ms** |
| TTFB | **< 200 ms** cached |
| First-load JS (public route) | **< 150 KB** gzip |
| Any single image | **< 200 KB** |
| Total page weight (home) | **< 1.0 MB** |

### 14.3 Required work

1. **Image pipeline** — convert to AVIF/WebP, generate responsive sizes, serve
   via `next/image` with explicit `sizes`, and preload the LCP image. Target
   ≥ 90 % byte reduction on every asset.
2. **SEO completeness** — per-page `alternates.canonical`, an
   `opengraph-image` route, a web manifest, richer JSON-LD (`Menu`,
   `MenuSection`, `MenuItem`, `BreadcrumbList`, `FAQPage`, `LocalBusiness` with
   `aggregateRating`), and JSON-LD generated from typed config instead of the
   hardcoded literal currently in `app/layout.tsx`.
3. **JS budget** — audit `framer-motion` v13 usage; prefer CSS for the simple
   reveal animations, or lazy-load motion components, to protect INP/TBT.
4. **Fonts** — keep `next/font` self-hosting, add `preload` only for the
   critical face, and subset aggressively.
5. **Caching headers** — long-lived immutable caching for hashed assets;
   `stale-while-revalidate` for HTML.
6. **Route-level code splitting** — verify the cart drawer, checkout modal and
   KDS board are not in the initial storefront bundle.

---

## 15. Delivery roadmap

Ten phases; correctness before optimisation. Each phase is independently
shippable and has explicit acceptance criteria. Full task breakdown, sequencing
and exit criteria are in [`ROADMAP.md`](./ROADMAP.md).

| Phase | Theme | Primary outcome | Risk |
| :--- | :--- | :--- | :--- |
| **0** | **Documentation & licensing** *(this deliverable)* | Truthful README, proprietary LICENSE + copyright, professional docs set, fixed `.gitignore` | ✅ Done |
| **1** | **Deployability** | The system actually deploys and the API is reachable in production; uploads use object storage | High value, low risk |
| **2** | **Database integrity & indexing** | `tenantId NOT NULL`, fail-closed resolution, composite/partial indexes, redundant indexes dropped, verified with `EXPLAIN` | Medium |
| **3** | **Stateless runtime** | Redis for cache, rate limit, idempotency, pub/sub; durable DB-backed outbox queue; worker + cron | High |
| **4** | **Security hardening** | Strict CORS, tighter CSP, RLS, per-endpoint rate limits, audit-driven fixes | Medium |
| **5** | **Testing depth** | Contract tests, load tests, a11y, coverage gate, Lighthouse CI | Medium |
| **6** | **SEO & performance** | Image pipeline, metadata completeness, JSON-LD from config, JS/font budgets | Low |
| **7** | **Observability & ops** | OTel tracing, metrics, dashboards, alerts, runbooks, backup/restore drill | Low |
| **8** | **Structure & DX** | `lib/` split into `domain/` + `infrastructure/`, ADRs, docs kept in sync, remove dead code | Medium |
| **9** | **Commercial readiness** | Multi-tenant onboarding, plan limits, billing hooks, tenant admin, SLA docs | High |

**Sequencing rationale:** Phase 1 unblocks real deployments. Phase 2 makes the
data layer fast and safe, which every later phase depends on. Phase 3 removes
the single largest correctness risk. Phase 4–5 make it trustworthy. Phase 6–7
make it fast and operable. Phase 8 is cosmetic-by-comparison and can run any
time **after** Phase 3. Phase 9 is a product decision, not a technical one.

---

## 16. Risk register

| # | Risk | Likelihood | Impact | Mitigation |
| :-- | :--- | :--- | :--- | :--- |
| R1 | In-memory state causes silent prod data loss (emails, KDS, webhooks) | **High** | **High** | Phase 3; add a startup check that refuses production boot without Redis |
| R2 | `tenantId` nullable + default fallback leaks cross-tenant data | Medium | **Critical** | Phase 2: `NOT NULL`, fail closed, RLS, tenant-crossover tests |
| R3 | Postgres connection exhaustion under serverless concurrency | **High** | **High** | Phase 2/3: explicit pool bounds + pooler in transaction mode |
| R4 | Uploads write `data:` URLs into Postgres, bloating it and breaking `next/image` | Medium | **High** | ~~Phase 1: install `@vercel/blob` or implement S3-compatible storage~~ **Closed 2026-10-15**: S3-compatible `lib/storage/` driver; never store binary in the database |
| R5 | Lighthouse 100 unreachable due to image weight | **Certain** | Medium | Phase 6 image pipeline (highest ROI item in the plan) |
| R6 | Permissive Express CORS with credentials enabled | Medium | **High** | Phase 4 |
| R7 | Migration on live data (NOT NULL) locks tables | Medium | Medium | Phase 2: expand→backfill→contract, `CONCURRENTLY` index creation, off-peak window |
| R8 | Scope creep — ten phases attempted at once | **High** | Medium | One phase per PR, each independently releasable, reviewed before the next starts |
| R9 | Two runtime adapters drift apart | Medium | Medium | Phase 5 contract tests fail CI on divergence |
| R10 | Uncommitted Phase 2.2 work is lost or entangled | Medium | Medium | Commit or stash in-flight work **before** Phase 1 begins |

---

## 17. Definition of done

A phase is complete only when **all** of the following hold:

- [ ] Every quality gate passes locally: `typecheck`, `lint`, `test`, `build`.
- [ ] New behaviour is covered by unit and/or integration tests.
- [ ] Security-relevant changes have a test proving the **negative** case.
- [ ] Database changes ship as reviewed migrations with a rollback plan and
      `EXPLAIN` evidence for any new index.
- [ ] No secret is committed; `.env.example` is updated with empty placeholders.
- [ ] Documentation is updated in the same change (README, `docs/`, CHANGELOG).
- [ ] `CHANGELOG.md` has an entry under `Unreleased`.
- [ ] Performance claims are backed by a measured number.
- [ ] The phase is verified end-to-end against a real PostgreSQL instance.
- [ ] `main` is left releasable.

---

**Related documents:** [Architecture](./ARCHITECTURE.md) · [Database](./DATABASE.md) ·
[Audit](./AUDIT.md) · [Roadmap](./ROADMAP.md) · [Operations](./OPERATIONS.md) ·
[Testing](./TESTING.md) · [SEO & Performance](./SEO-AND-PERFORMANCE.md) ·
[ADRs](./adr/) · [Security Policy](../SECURITY.md)

© 2026 Himanshu. All Rights Reserved.
