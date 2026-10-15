# Engineering Audit

**Project:** Spice & Saffron — Indian Fine Dining & Café Platform
**Auditor:** Senior engineering review
**Date:** 2026-10-15
**Commit:** `022ab0c` + uncommitted Phase 2.2 working tree
**Method:** static review of every infrastructure module, the schema, both API
adapters, build log analysis, and execution of the full local quality gate
(`typecheck`, `lint`, `vitest`, `next build`).

---

## 1. Audit scope and honest limitations

**What was actually executed (evidence, not opinion):**

| Command | Result |
| :--- | :--- |
| `npx tsc --noEmit` | Clean — 0 errors |
| `npm run lint` | Clean — 0 errors, 0 warnings |
| `npx vitest run` | **148 passed / 27 test files**, ~57 s |
| `npm run build` | Succeeds — 40 routes; **1 module-not-found warning**; **1 slow-query warning** |
| `git ls-files` tracking check | Only `README.md` and `FILE_STRUCTURE.md` are tracked markdown |

**What was reviewed statically:** `prisma/schema.prisma` (all 26 models),
`server/api.ts`, every `lib/**` infrastructure module, `app/api/**` route
handlers, `app/layout.tsx`, `next.config.ts`, `vercel.json`, `.gitignore`,
`.env.example`, both CI workflows, `vitest.config.ts`, `playwright.config.ts`.

**What was NOT executed — and therefore is not claimed as measured:**

- ❌ No Lighthouse run (no browser audit performed). Performance findings are
  derived from asset weights and code review, and are labelled as such.
- ❌ No load or concurrency test.
- ❌ No penetration test. Security findings are from code review.
- ❌ No dependency CVE enumeration (`npm audit` was not run in this pass).

---

## 2. Severity summary

| Severity | Count | Meaning |
| :--- | :--- | :--- |
| 🔴 **Critical (P0)** | **5** | Data corruption, money loss, tenant data leakage, or non-deployability |
| 🟠 **High (P1)** | **9** | Breaks at scale or in production; security weakness |
| 🟡 **Medium (P2)** | **11** | Correctness, performance, or maintainability debt |
| 🔵 **Low (P3)** | **6** | Polish, accuracy, hygiene |

**Headline:** the application logic is genuinely good and the security
foundations are real — but the platform is **not production-deployable today**,
and one route has a **live money-loss vulnerability**.

---

## 3. 🔴 Critical findings (P0)

### P0-1 · Client-controlled pricing on the B2B order route — money loss

**Location:** `app/api/v1/orders/route.ts:22`, `:93–96`

```ts
items: z.array(z.object({
  price: z.number().positive(),   // ← price supplied BY THE CLIENT
}))...

const subtotal = data.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
const total = subtotal + tax - discount;
```

The route trusts the caller's `price` for every line item and never re-reads
`db.dish.price`. Any holder of a valid `sp_live_…` key with `orders:write` — and
per `server/api.ts:35`, the Express CORS gate echoes **any** origin — can create
an order for any amount, including ₹0.01.

This is precisely the class of vulnerability commit `3897aa2` claims to have
patched ("patch client-side price tampering"). The patch evidently covered the
customer-facing path (`lib/services/orders.ts`) but **not this B2B adapter**.
It also reproduces the divergence risk the master plan warns about: `server/api.ts`
has **no order-creation endpoint at all**, so there is nothing to compare against.

**Impact:** direct revenue loss; fraudulent orders; corrupted analytics and
loyalty accrual; a poisoned kitchen ticket.

**Additional defects in the same handler:**
- No idempotency — a retried `POST` creates a duplicate order.
- No rate limiting.
- No inventory / auto-86 check.
- Tax hardcoded at 5 % (`:94`), discount hardcoded to 0 (`:95`) — ignores the
  coupon engine entirely.
- No loyalty accrual, despite `Order.loyaltyPointsEarned` existing.
- `orderNumber` uses `Date.now()` + a 4-digit random (`:98–99`): only **9 000**
  distinct values per millisecond against a `@unique` column — collides under
  burst, and a retry after a unique violation fails instead of retrying.

**Fix:** delete the adapter's pricing entirely; delegate to
`lib/services/orders.ts` (`createOrder`) so pricing, coupons, loyalty,
inventory and idempotency are enforced in one place. See **Phase 1 / Phase 5**.

---

### P0-2 · Production state lives in process memory

**Location:** `lib/realtime/bus.ts:24`, `lib/queue/job-queue.ts:26,83`,
`lib/rate-limit/limiter.ts:12`, `lib/cache/cache-manager.ts:11`

```ts
const bus = globalThis.__realtimeBus ?? new EventEmitter();        // realtime
private queue: Job[] = [];  ...  setInterval(...)                  // job queue
const memStore = new Map<string, Bucket>();                        // rate limit
const memCache = new Map<string, CacheEntry<unknown>>();           // cache
```

Every one of these is per-process. Consequences on any multi-instance or
serverless deployment:

| Component | Production failure |
| :--- | :--- |
| Event bus | A kitchen ticket raised by instance A is **invisible** to an SSE client on instance B. The KDS silently drops tickets. |
| Job queue | `setInterval` never runs reliably in a frozen lambda; jobs are **lost on every deploy**. Emails and outbound webhooks vanish. |
| Rate limiter | Limits multiply by the instance count — effectively no protection. |
| Cache | Hit rate collapses to ~1/N and instances serve divergent stale data. |

**Already observable today:** the two runtimes (`server/api.ts` and
`app/api/v1/*`) each hold *separate* copies of the same singletons, so the
Express SSE stream cannot see tickets created through the Next.js route even on
a single machine.

**Note:** `lib/cache/cache-manager.ts` and `lib/resilience/idempotency.ts` **do**
implement Upstash Redis paths — the capability exists. The defect is that the
in-memory fallback is silent and unconditional, so a misconfigured production
deploy degrades without any error or alert.

**Fix (Phase 3):** make Redis a required production dependency with a boot-time
assertion; move the queue to a durable database-backed outbox drained by a
worker; replace the event bus with Redis pub/sub.

---

### P0-3 · `tenantId` is nullable and tenant resolution fails open

**Location:** `prisma/schema.prisma` (all tenant-scoped models),
`lib/db/tenant.ts:54–67`

```ts
export async function resolveTenant(slug?: string | null): Promise<TenantContext> {
  if (!slug || slug === DEFAULT_TENANT_SLUG) return getOrCreateDefaultTenant();
  const tenant = await db.tenant.findUnique({ where: { slug } });
  if (!tenant || !tenant.isActive) {
    return getOrCreateDefaultTenant();   // ← unknown tenant returns the DEFAULT tenant
  }
  return tenant;
}
```

A request for a non-existent or suspended tenant is served the **flagship
tenant's** data instead of being rejected. Combined with nullable `tenantId`
everywhere, every tenant-scoped read is written as
`OR: [{ tenantId }, { tenantId: null }]`
(`app/api/v1/orders/route.ts:47`, `server/api.ts:164,192`), which both:

1. **leaks the default tenant's records into every other tenant's response**, and
2. **defeats index usage**, because an `OR` across a nullable column cannot be
   served by a single index seek.

`getOrCreateDefaultTenant()` is also called on hot read paths — including on
**every SSE connection** (`app/api/v1/realtime/kds/route.ts:39`) — and can
perform five `updateMany` backfills inside a request.

**Fix (Phase 2):** backfill `tenantId`; make it `NOT NULL`; resolve strictly and
return `404` for an unknown tenant; cache the tenant lookup; add RLS as defence
in depth.

---

### P0-4 · The API cannot deploy as designed; uploads corrupt the database

**Location:** `vercel.json`, `app/api/upload/route.ts:63–91`, `package.json`

`vercel.json` deploys Next.js only. The B2B/KDS surface is described as a
standalone Express service on port `4000` (`server/api.ts`) — **there is no port
4000 on Vercel**, so in production the documented API is unreachable.

The upload handler compound-fails:

```ts
if (process.env.BLOB_READ_WRITE_TOKEN) {
  const blobModule = "@vercel/blob";
  const { put } = (await import(blobModule)) as { put: any };   // ⚠️ NOT INSTALLED
  ...
}
// fallback 1: write to public/uploads  → read-only on Vercel
// fallback 2: return `data:${mime};base64,${...}`  → stored in Postgres
```

`@vercel/blob` is **absent from `package.json`** (confirmed by the build warning
`Module not found: Can't resolve '@vercel/blob'`). On Vercel the filesystem is
read-only, so the handler falls through to a **base64 `data:` URL that is then
persisted into the database** — inflating rows to megabytes, defeating
`next/image` optimisation, and blowing past payload limits.

**Fix (Phase 1):** resolve the runtime decision (Route Handlers as the
production API) and install a real object store — `@vercel/blob` or an
S3-compatible client. Never persist binary in Postgres; fail the upload instead.

> **Resolved 2026-10-15.** Replaced the compound fallback with a storage
> abstraction (`lib/storage/`) and a vendor-neutral S3-compatible driver
> (`@aws-sdk/client-s3`). The route now validates by magic bytes, enforces a size
> cap, re-encodes to strip metadata, and returns `503` when no store is
> configured — the base64 path is deleted and the build warning is gone.
> Covered by `tests/unit/storage.test.ts`.

---

### P0-5 · Order confirmation emails are never sent

**Location:** `lib/queue/handlers.ts:65–74` vs `server/api.ts:292–299`

The webhook handler enqueues a job that *claims* to confirm payment:

```ts
globalJobQueue.enqueue("EMAIL_DISPATCH", {
  to: order.customerEmail,
  subject: `Order Confirmation #${order.orderNumber} - Spice & Saffron`,
  body: `Thank you for your order! Your payment has been confirmed.`,
  ...
});
```

But the registered handler only writes a log line:

```ts
globalJobQueue.registerHandler("EMAIL_DISPATCH", async (payload) => {
  logger.info({ event: "email.dispatched", recipient: email.to, ... });  // no send
});
```

It never calls `lib/email/notifier.ts` (which exists and is unit-tested). Every
customer who pays receives **no confirmation**. Combined with P0-2, the job is
also lost on deploy even if it were wired up.

**Impact:** silent customer-facing failure on the highest-value flow. Also
misleading operational telemetry — logs assert an email was dispatched that was
never sent.

**Fix (Phase 1):** call the real notifier, and make the handler fail loudly
(so the retry/DLQ path engages) instead of logging success.

---

## 4. 🟠 High findings (P1)

### P1-1 · Permissive CORS with credentials on the standalone API
`server/api.ts:29–42` — the origin callback calls `callback(null, true)` on
**both** branches, so the allowlist is decorative while
`credentials: true` is set. `allowedHeaders` also omits `Idempotency-Key`,
which the middleware expects. **Fix:** Phase 4.

### P1-2 · No connection-pool bounds; serverless will exhaust Postgres
`lib/db/prisma.ts:8` — `new PrismaPg({ connectionString })` with no `max`, no
`idleTimeoutMillis`, no `connectionTimeoutMillis`, no `statement_timeout`. Each
lambda instance opens its own pool against a default `max_connections`.
**Fix:** Phase 2/3.

### P1-3 · Redis cache invalidation uses `KEYS` — O(N) and blocking
`lib/cache/cache-manager.ts:138` — `fetch(\`${UPSTASH_URL}/keys/${prefix}*\`)`.
`KEYS` scans the entire keyspace and blocks Redis. **Fix:** `SCAN` cursors, or
better, versioned key prefixes. Phase 3.

### P1-4 · Idempotency key is not bound to the request payload
`lib/resilience/idempotency.ts:54` — `acquire(key)`. Reusing a key with a
*different* body replays the first response instead of returning `409`. Also the
key is not scoped per tenant or per endpoint. **Fix:** Phase 3/4.

### P1-5 · `lastUsedAt` write on every authenticated S2S request
`lib/auth/s2s.ts:117–120` — an unthrottled `UPDATE` on the auth hot path,
multiplying write load and creating lock contention. **Fix:** sample or debounce
(e.g. only when older than 60 s). Phase 4.

### P1-6 · `verifyS2SRequest` constant-time comparison is theatrical
`lib/auth/s2s.ts:101–105` — the values compared were already matched by
`findUnique({ where: { keyHash: tokenHash } })`, so `timingSafeEqual` here
defends nothing while documentation claims it "prevents side-channel timing
leaks". Harmless but inaccurately documented. **Fix:** correct the claim and
keep the lookup (which is already constant-time by construction). Phase 4.

### P1-7 · Money precision: `Number()` and float arithmetic
`server/api.ts:118`, `app/api/v1/orders/route.ts:93`, `:140` — `Number(d.price)`
and `reduce(sum + price * qty)` on IEEE-754 floats. Rounding drift across a
discount, a tip and a tax is real. **Fix:** integer minor units or `Decimal`
arithmetic throughout the pricing path. Phase 2.

### P1-8 · `Order` has no idempotency key persisted and no tenant-scoped uniqueness
`prisma/schema.prisma:317` — `orderNumber @unique` is global. `(tenantId,
orderNumber)` should be the constraint, and the idempotency key should be a
unique column so replay safety survives a cache flush. **Fix:** Phase 2/3.

### P1-9 · LCP image is 951 KB and about to be served on every visit
`public/images/hero/hero-dining.jpg` (951 KB) plus eleven more assets at
950–965 KB and one PNG at 2 862 KB. Performance budgets are unreachable.
**Fix:** Phase 6 (highest ROI item in the plan).

---

## 5. 🟡 Medium findings (P2)

| # | Finding | Evidence | Fix phase |
| :-- | :--- | :--- | :--- |
| P2-1 | **Redundant duplicate indexes** waste writes: a `@unique` already creates a B-tree. `Tenant.slug`, `Category.slug`, `Dish.slug`, `Coupon.code`, `ApiKey.keyHash` each have **both** `@unique` and `@@index([sameColumn])`; `Admin.email @unique` + `@@index([email])`. | `schema.prisma:119/139, 181/194, 203/229, 454/464, 146/159, 437/444` | 2 |
| P2-2 | **Missing composite indexes for real query shapes.** The menu query is `WHERE categoryId=? AND isAvailable=true AND deletedAt IS NULL ORDER BY sortOrder`; only `@@index([categoryId])` exists ⇒ filter + sort in memory. This is the **195 ms `Dish.findMany`** in the build log. | build log; `schema.prisma:228` | 2 |
| P2-3 | **No index supports the list queries**: `Order` ordered by `createdAt desc` filtered by `tenantId`+`orderStatus`; `ContactMessage`, `ActivityLog`, `LoyaltyLedger`, `WaitlistEntry` all lack cursor-friendly composites. | `schema.prisma:347–352, 263, 278–280, 609–611` | 2 |
| P2-4 | **Four domain contexts have no `tenantId` at all**: `GalleryImage`, `ContactMessage`, `Review`, `Setting` — they leak across tenants by construction. `Coupon` likewise. | `schema.prisma:237, 252, 418, 283, 435` | 2 |
| P2-5 | **Globally-unique columns block multi-tenancy**: `Category.slug`, `Dish.slug`, `Coupon.code`, `Setting.key`, `Admin.email` are `@unique` globally, so two tenants cannot both have a "paneer-tikka" or a "SILVER" setting key. | `schema.prisma:181, 203, 437, 285, 146` | 2 |
| P2-6 | **`resolveTenant` / `getOrCreateDefaultTenant` cache-free and write-capable on read paths**, including every SSE connect. | `lib/db/tenant.ts:17–49`, `realtime/kds/route.ts:39` | 2 |
| P2-7 | **Job queue metrics are meaningless under concurrency**: `processing: this.isProcessing ? 1 : 0` can never exceed 1, and `completedCount`/`failedCount` reset per process. | `lib/queue/job-queue.ts:148–152` | 3 |
| P2-8 | **KDS broadcast tenant key can be a slug, not a UUID**: `tenantId: order.tenantId \|\| "spice-saffron"` publishes to channel `tenant:spice-saffron`, while subscribers register with a UUID ⇒ the event is never delivered. | `server/api.ts:287` vs `realtime/kds/route.ts:40` | 2 |
| P2-9 | **The entire Express API surface is untested.** 27 test files cover Next.js and `lib/`; nothing covers `server/api.ts` (menu, orders, coupons, SSE, webhook, metrics). | `tests/**` inventory | 5 |
| P2-10 | **JSON-LD is hardcoded and duplicates config**: `app/layout.tsx:43–76` restates the street address, postcode, phone and hours that already live in `config/site.ts` — two sources of truth that will drift. | `app/layout.tsx:55–72` | 6 |
| P2-11 | **No coverage instrumentation or gate**; `vitest.config.ts` has no `coverage` block and `@vitest/coverage-v8` is not installed. Coverage is unknown. | `vitest.config.ts` | 5 |

---

## 6. 🔵 Low findings (P3)

| # | Finding | Evidence |
| :-- | :--- | :--- |
| P3-1 | **README is broken on GitHub** — the `<div align="center">` HTML block is terminated early by a blank line, so the `**[Our Story](#…)**` TOC line renders as raw markdown and `</div>` becomes a stray tag; GitHub's sanitiser also strips `style=` on the banner `<img>`. | `README.md:23–27` |
| P3-2 | **README links to 404s** — it links `HANDOFF.md` and mentions `AI_CONTEXT.md`, but `git ls-files` proves neither is tracked (`.gitignore:62–63`). | `README.md:324–325` |
| P3-3 | **README claims MIT with no `LICENSE` file**, and states outdated metrics ("115 tests / 20 suites") versus the measured 148/27. Also documents `RESEND_API_KEY`, which does not exist — the variable is `EMAIL_API_KEY`. | `README.md:302, 331`, `.env.example:20` |
| P3-4 | **`.gitignore` ignores `/docs/`**, which would silently unpublish the entire documentation set. | `.gitignore:65` |
| P3-5 | **Non-professional package identity**: `"name": "cafe-scaffold"`, no `author`, no `license` field, no `engines`. | `package.json:2` |
| P3-6 | **CI audit threshold too lax** (`--audit-level=critical` only) and **no coverage, a11y, Lighthouse, contract or load gates**; `vitest.config.ts` also emits a Vite ESM-in-CJS warning that will break under a future Vite default. | `.github/workflows/security.yml:26`, `vitest.config.ts:1` |

---

## 7. What is genuinely strong — protect this

Auditing is meaningless without recording what must **not** regress.

| Strength | Evidence |
| :--- | :--- |
| **Argon2id password hashing** with per-user salts | `lib/auth/passwords.ts` |
| **Sessions store only a SHA-256 hash**; cookies `HttpOnly`/`SameSite`/`Secure` | `lib/auth/session.ts` |
| **Server-side authoritative pricing on the customer path** with explicit tampering tests | `lib/services/orders.ts`, `tests/security/*` |
| **Zod validation** at every route boundary | all `app/api/**` |
| **Prisma parameterisation** everywhere; no string-built SQL | repo-wide |
| **RBAC with a permission matrix** and `requirePermission` guards | `config/roles.ts`, `lib/auth/guards.ts` |
| **Immutable audit log** for privileged mutations | `lib/services/audit.ts`, `ActivityLog` |
| **HMAC-verified, idempotent payment webhook ingress** | `lib/payments/engine.ts`, `server/api.ts:244` |
| **Slow-query telemetry** already wired into Prisma | `lib/db/prisma.ts:11–30` |
| **Real security headers + CSP** (not a token gesture) | `next.config.ts:7–35` |
| **Solid SEO baseline**: metadata, OG, Twitter, `Restaurant` JSON-LD, `robots.txt`, dynamic `sitemap.xml` | `app/layout.tsx`, `app/robots.ts`, `app/sitemap.ts` |
| **148 passing tests** across unit, integration and security suites | `npx vitest run` |
| **CI with a real Postgres service**, migrations, seed, and Playwright on desktop **and** mobile | `.github/workflows/ci.yml` |
| **`proxy.ts` correctly documented as a cheap first gate, never the only guard** | `proxy.ts:4–7` |

---

## 8. Remediation order

Prioritised by **(severity × likelihood) ÷ effort**:

| Order | Finding(s) | Phase |
| :--- | :--- | :--- |
| 1 | **P0-1** price tampering, **P0-5** missing emails, **P0-4** upload/deploy | **1** |
| 2 | **P0-3** tenant isolation, **P2-1…P2-6** indexing & pooling | **2** |
| 3 | **P0-2** memory state (**P1-3, P1-4, P2-7, P2-8**) | **3** |
| 4 | **P1-1** CORS, **P1-5, P1-6** auth hardening | **4** |
| 5 | **P2-9** untested Express surface, **P2-11** coverage, **P3-6** CI gates | **5** |
| 6 | **P1-9** image pipeline, **P2-10** JSON-LD duplication | **6** |
| 7 | Observability, runbooks, restore drill | **7** |
| 8 | Structure, docs, ADRs, dead code | **8** |

---

## 9. Immediate pre-work

⚠️ **The working tree contains uncommitted Phase 2.2 work** (stations,
inventory, tables, waitlist, loyalty — including an unapplied migration
`20260905180000_add_stations_inventory_tables_loyalty`). Per risk **R10**, this
must be committed or stashed **before** Phase 1 begins, or every subsequent diff
becomes unreadable and the migration history gets entangled.

---

**Related:** [Master Plan](./MASTER_PLAN.md) · [Roadmap](./ROADMAP.md) ·
[Database](./DATABASE.md) · [Architecture](./ARCHITECTURE.md) ·
[Testing](./TESTING.md) · [SEO & Performance](./SEO-AND-PERFORMANCE.md)

© 2026 Himanshu. All Rights Reserved.
