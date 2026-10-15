# Testing & Quality Engineering

**Project:** Spice & Saffron — Multi-Tenant Indian Café & Restaurant Platform
**Owner:** Himanshu ([@Himanshusingh204](https://github.com/Himanshusingh204)) · himanshuyt21361@gmail.com
**Document status:** Living strategy — measured baseline + proposed target
**Last updated:** 2026-10-15

> Every number in the **inventory** sections was measured against the repository
> on 2026-10-15 (`npx vitest run` → 148 passed, 27 files, ~57 s, serial).
> Everything in the **target** sections (coverage floors, load thresholds,
> Lighthouse budgets) is a **proposal**, not a measurement, and is labelled as
> such wherever it appears.

---

## Table of contents

1. [Testing philosophy](#1-testing-philosophy)
2. [Current state inventory](#2-current-state-inventory)
3. [The three suites explained](#3-the-three-suites-explained)
4. [End-to-end testing](#4-end-to-end-testing)
5. [CI quality gates](#5-ci-quality-gates)
6. [Gap analysis](#6-gap-analysis)
7. [Target test strategy](#7-target-test-strategy)
8. [Required new test matrix](#8-required-new-test-matrix)
9. [Coverage policy](#9-coverage-policy)
10. [Performance & load testing plan](#10-performance--load-testing-plan)
11. [Accessibility testing plan](#11-accessibility-testing-plan)
12. [SEO & performance gate plan](#12-seo--performance-gate-plan)
13. [Test data & fixtures policy](#13-test-data--fixtures-policy)
14. [Writing a good test](#14-writing-a-good-test)
15. [Definition of done for tests](#15-definition-of-done-for-tests)
16. [Further reading & related documents](#16-further-reading--related-documents)

---

## 1. Testing philosophy

Spice & Saffron is a **money-moving, multi-tenant** application. A test suite here
is not a box to tick — it is what lets us change pricing, tenant resolution,
payments and the kitchen pipeline without shipping a regression to a live
restaurant. That raises the bar on what a test must prove.

### 1.1 The pyramid for this codebase

```
   ▲  few, slow, high-fidelity
  ╱ ╲
 ╱e2e╲        Playwright — real Next.js build, real Postgres, real browser.
╱─────╲       "Does the journey work end to end?"
╱contract╲    Express ⇄ Next route parity. "Do the two runtimes agree?"
╱integration╲ Services + route handlers against a real database.
╱    unit     ╲ Pure functions, schemas, engines — no I/O.
▼  many, fast, cheap
```

| Level | Belongs here | Does **not** belong here |
| :--- | :--- | :--- |
| **Unit** | Pure logic (`lib/utils`, validators, GST/cost math, `generateOrderNumber`, `hasPermission`, in-memory cache/idempotency/queue engines) | Anything needing Prisma, Postgres, network, or `next/headers` |
| **Integration** | Service functions in `lib/services/**` and route handlers that own SQL, transactions, audit logs, soft-delete, pagination | Browser interaction; asserting an exact SQL string |
| **Security** | Negative assertions: mass-assignment, injection, cross-tenant reads, IDOR, forged signatures, privilege escalation | Happy-path coverage (that is unit/integration) |
| **Contract** | That `server/api.ts` and `app/api/v1/*` return the same shape/status for the same logical operation | Business tuning |
| **E2E** | A handful of critical visitor and admin journeys through a real build | Every permutation of a form field |

### 1.2 Principles

1. **Test behaviour and contracts, not implementation.** Assert *what* a service
   returns and *what side effects* it has (row created, audit written, event
   emitted) — never *how*. A test that breaks when a private helper is renamed,
   with behaviour unchanged, is a liability.
2. **The contract is the unit of trust between runtimes.** The same domain logic
   is exposed through **two adapters** (Next Route Handlers and the standalone
   Express server), so method, path, request/response shape, status codes and
   auth scope are the thing both must honour. Test the contract explicitly, and
   test it *once*, shared.
3. **Determinism is non-negotiable.** A test must yield the same result on every
   run, machine, and order:
   - **No wall-clock dependence** — never assert `createdAt` equals "now"; never
     rely on the current time being inside opening hours. Inject or fake time.
   - **No random ordering** — suites share one database; ordering coupling is a
     bug, not a feature.
   - **No shared mutable state across files** — each file sets up what it needs.
     (One accepted exception lives *inside* a single E2E run; see §4.)
   - **No network in tests** — external calls (Resend, Razorpay, Blob) are stubbed
     or pointed at loopback.
4. **Tests are code and get reviewed like code.** No commented-out assertions, no
   weakened expectations to make red go green. If behaviour is wrong, fix it or
   change the contract deliberately — never the assertion quietly.
5. **A failing test must point at a cause.** Prefer one assertion of meaning over
   ten of shape.

---

## 2. Current state inventory

> **This table reflects the repository as it exists today.** Counts and the
> pass/time figure are measured; descriptions derive from each file's
> `describe`/`it` names.

**Measured baseline (`npx vitest run`):** ✅ **148 tests passed across 27 files**,
serial, **~57 s** wall-clock. No coverage instrumentation is configured.

### 2.1 Unit suite — `tests/unit/` (17 files)

| File | What it covers |
| :--- | :--- |
| `cache.test.ts` | `CacheManager`: store/retrieve, TTL expiry, delete by key & prefix, `getOrSet`. |
| `email-notifier.test.ts` | `sendContactNotification`: disabled until configured; escapes content; posts to Resend; degrades without throwing. |
| `hours-and-modifiers.test.ts` | Open/closed/cutoff, pickup slots, `DINE_IN` vs ASAP, modifier totals, gratuity, composite keys. |
| `idempotency.test.ts` | `IdempotencyManager` lock/in-flight/replay/release; Express middleware pass-through + dedup. |
| `inventory-auto86.test.ts` | Ingredient par-levels, recipe linkage, depletion + Auto-86 at zero, restore on restock. |
| `loyalty.test.ts` | VIP tiering, tier multipliers, points accrual, redemption ledger. |
| `orders.test.ts` | `generateOrderNumber` shape; 5% GST and discount math. |
| `payments.test.ts` | Razorpay sandbox order + paise; signature accept/reject/missing-secret; webhook HMAC. |
| `permissions.test.ts` | `hasPermission` for SUPER_ADMIN / ADMIN / EDITOR. |
| `queue.test.ts` | `JobQueue`: register/process, DLQ after max retries, manual retry. |
| `request-utils.test.ts` | `hashIp`: 40-hex, stability, per-IP divergence, IPv6. |
| `reservations.test.ts` | Reservation reference-code generation (`RES-`). |
| `reviews.test.ts` | Rating clamping to 1–5. |
| `s2s-auth.test.ts` | API key generation (`sp_live_…`, SHA-256), scope enforcement, HMAC signing. |
| `tables-waitlist.test.ts` | Table creation/QR URL, status transitions, waitlist estimate + advance. |
| `utils.test.ts` | `slugify`, `ensureUniqueSlug`, `formatPrice`. |
| `validation.test.ts` | `loginSchema`, `contactMessageSchema` (honeypot), `dishInputSchema` coercion + rejection. |

### 2.2 Integration suite — `tests/integration/` (8 files)

| File | What it covers |
| :--- | :--- |
| `api-health.test.ts` | `/api/health` returns healthy status with timestamp. |
| `audit.test.ts` | Activity-log creation across field permutations (null actor/entity, action types). |
| `auth.test.ts` | Argon2id verify/reject, unique salt, session hashing, valid/expired/deactivated/tampered sessions, logout, revoke-all. |
| `gallery.test.ts` | Gallery CRUD, NOT_FOUND paths, audit side effects, imageUrl preservation. |
| `menu.test.ts` | Dish CRUD, slug uniqueness, soft vs hard delete, toggles, transactional reorder, category-deletion guard. |
| `messages.test.ts` | Contact-message persistence, status workflow, NOT_FOUND, admin filter/pagination, dashboard counts. |
| `rate-limit.test.ts` | Allow-up-to-max, retry delay, per-key isolation, window reset. |
| `settings.test.ts` | `normalizeSettings`, persistence, audit on update, cached read. |

### 2.3 Security suite — `tests/security/` (2 files)

| File | What it covers |
| :--- | :--- |
| `mass-assignment.test.ts` | Injected privilege fields stripped from dish/category/contact; login cannot carry `role`; sort allow-listing. |
| `payloads.test.ts` | Control-char stripping, honeypot, email normalisation, phone/price bounds, strict slug, size limits, boolean coercion, prep-time/calorie bounds. |

### 2.4 End-to-end suite — `tests/e2e/` (2 specs, under Playwright)

| Spec | What it covers |
| :--- | :--- |
| `public.spec.ts` | Homepage + nav; menu from DB with working anchors; gallery; FAQ; contact validate-then-submit; branded 404. |
| `admin.spec.ts` | Anonymous redirect; generic login error (no enumeration); forged cookie grants nothing; dashboard stats; create category → dish → sign out; inbox shows the visitor submission. |

### 2.5 Supporting files

| Path | Role |
| :--- | :--- |
| `tests/helpers/db.ts` | Allow-listed `truncateTables`, `uniqueSuffix`, `makeAdmin`, `makeCategory`, `dishInput`. |
| `tests/setup/global-setup.ts` | Creates the test DB (if absent) and runs `prisma migrate deploy`. |
| `tests/setup/test-db-url.ts` | `requireDatabaseUrl`, `toAdminDatabaseUrl`, `toTestDatabaseUrl` (derives `indian_cafe_test`). |
| `tests/setup/server-only-stub.ts` | No-op replacement for the `server-only` package under Vitest. |
| `tests/e2e/global-setup.ts` | Creates + migrates + seeds the isolated e2e DB. |

**Honest note:** the Next.js application is well covered, but the **entire Express
adapter (`server/api.ts`) is untested** and no contract test binds the two
runtimes (Gap 1/2).

---

## 3. The three suites explained

The Vitest suites (unit + integration + security) share one config,
`vitest.config.ts`, and **one** database. Understanding that shared context is
essential to writing a safe test.

### 3.1 Scope

- **Unit** (`tests/unit/`): pure logic and in-memory engine behaviour. Fast, no
  database, no network.
- **Integration** (`tests/integration/`): service functions and route-handler
  logic against a **real Postgres test DB**. These own SQL correctness:
  transactions, soft-delete filters, audit writes, pagination.
- **Security** (`tests/security/`): negative assertions. A security suite only if
  each test *would fail* when the guard is removed.

### 3.2 How they are wired

```ts
// vitest.config.ts (as it exists today)
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "tests/e2e/**"],
    // Suites share one test database, so files must not truncate concurrently.
    fileParallelism: false,
    globalSetup: "./tests/setup/global-setup.ts",
    env: {
      DATABASE_URL: toTestDatabaseUrl(requireDatabaseUrl()),
      NODE_ENV: "test",
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/setup/server-only-stub.ts", import.meta.url)),
    },
  },
});
```

Three things to internalise:

1. **The shared-database constraint.** `fileParallelism: false` is a correctness
   requirement: every file points at the same `indian_cafe_test` DB and several
   call `truncateTables(...)`. Concurrent truncation/seeding would race. The cost
   is throughput (Gap 15). **Rule: never truncate in parallel; never assume
   another file ran first.**
2. **The `server-only` alias.** Modules declaring `import "server-only"` throw
   outside an RSC runtime; Vitest resolves that specifier to
   `tests/setup/server-only-stub.ts` so server modules import cleanly in Node.
3. **Test-DB URL derivation.** `tests/setup/test-db-url.ts` rewrites the
   configured `DATABASE_URL` path to `indian_cafe_test`, so tests never touch the
   dev database; the admin URL (path `/postgres`) is used only to `CREATE
   DATABASE` if missing. `global-setup.ts` then runs `prisma migrate deploy`. **The
   test DB is a real schema** — migrations are the source of truth.

### 3.3 Known configuration friction (honest)

- **No coverage configuration exists** — `@vitest/coverage-v8` is not installed,
  no thresholds (§9).
- **ESM/CJS warning** — Vite warns that `vitest.config.ts` and
  `tests/setup/test-db-url.ts` use ESM syntax in a file loaded as CommonJS. Fix:
  rename to `.mts`, or set `"type": "module"`. Flagged so it is not mistaken for a
  failure.

---

## 4. End-to-end testing

E2E is Playwright driving a **production Next.js build** (`next build` + `next
start`) against the isolated, seeded test database, across **two viewports**.

```ts
// playwright.config.ts (as it exists today)
const PORT = Number(process.env.E2E_PORT ?? 3100);
const testDbUrl = toTestDatabaseUrl(requireDatabaseUrl());

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile-chrome",
      use: { viewport: { width: 412, height: 915 }, hasTouch: true, userAgent: devices["Pixel 7"].userAgent },
    },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      ...cleanEnv,
      DATABASE_URL: testDbUrl,
      APP_URL: `http://localhost:${PORT}`,
      LOGIN_RATE_MAX: "100",
      CONTACT_RATE_MAX: "50",
    },
  },
});
```

### 4.1 Design decisions and why they matter

- **Two viewports, one codebase.** `chromium` (Desktop Chrome) and `mobile-chrome`
  (412×915, touch, Pixel 7 UA) run the same specs — the cheapest way to catch
  responsive/touch breakage without a separate mobile suite.
- **`APP_URL` must equal the served origin.** CSRF protection compares the request
  `Origin` against `APP_URL`; if they disagree, **every mutation (login, contact
  submit, admin edits) is rejected**. E2E must serve on exactly the origin it
  advertises.
- **Rate-limit overrides.** `LOGIN_RATE_MAX=100`, `CONTACT_RATE_MAX=50` widen the
  limiter so a legitimately repetitive suite does not lock *itself* out mid-run.
- **Serial, single worker.** `fullyParallel: false` + `workers: 1`. The admin
  inbox spec asserts on the message the public spec **submitted earlier in the
  same run** — a deliberate intra-run dependency that parallelism would break.
- **`next start` on 3100, health-gated.** Playwright waits on `/api/health` (120 s)
  so tests never start against a half-booted server; `reuseExistingServer` is only
  `true` outside CI to speed local re-runs.
- **Seeded DB.** `tests/e2e/global-setup.ts` creates the DB, runs `prisma migrate
  deploy`, then `prisma db seed` with `SEED_DEMO_DATA=true` for real content.
- **Artifacts on failure.** `trace: "retain-on-failure"` plus the CI report upload
  (§5) makes a red job debuggable from the artifact alone.

### 4.2 What E2E should and should not do

- **Yes:** the money/lockout-critical journeys — browse menu → order, contact
  submit, admin login + RBAC redirects, forged-cookie rejection, media approval.
- **No:** exhaustive re-testing of every validation rule (that is unit/security).
  Keep E2E to journeys where the *wiring between layers* is the risk.

---

## 5. CI quality gates

### 5.1 `.github/workflows/ci.yml` — job `verify`

Runs on `push` to `main` and every `pull_request`.

| Step | Command |
| :--- | :--- |
| Service | `postgres:16-alpine` (user/pass `postgres`, db `indian_cafe`, `pg_isready` health check) |
| Checkout / Node | `actions/checkout@v4`, `actions/setup-node@v4` (Node 22, npm cache) |
| Install | `npm ci` |
| Prisma | `npx prisma generate` |
| Migrate | `npx prisma migrate deploy` |
| Seed | `npm run db:seed` (`SEED_DEMO_DATA=true`) |
| Lint | `npm run lint` |
| Typecheck | `npm run typecheck` |
| Tests | `npm test` (= `vitest run`) |
| Build | `npm run build` |

Env for `verify`: `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/indian_cafe?schema=public`,
`AUTH_SECRET=ci-only-secret-never-used-in-production`, `APP_URL=http://localhost:3000`.

### 5.2 `.github/workflows/ci.yml` — job `e2e` (`needs: verify`)

Own Postgres service, then `npm ci` → `prisma generate` → `migrate deploy` →
`db:seed` → `npx playwright install --with-deps chromium` → `npm run build` →
`npx playwright test` → on failure, upload the `playwright-report/` artifact
(7-day retention). `APP_URL=http://localhost:3100` matches the served e2e origin.

### 5.3 `.github/workflows/security.yml`

Triggers: push to `main`, pull requests, and a weekly schedule (Mondays 04:00
UTC). Runs **only**:

```yaml
- name: Audit for critical vulnerabilities
  run: npm audit --audit-level=critical
```

This is **too lax**: `critical` lets `high` (and all `moderate`/`low`) advisories
through, and there is no secret scanning or coverage job alongside it.

### 5.4 What CI does **not** run today

No coverage gate; no load/performance test; no accessibility check; no Lighthouse
CI / performance budget; no visual regression; no runtime contract test.

---

## 6. Gap analysis

Phases referenced below (see [`MASTER_PLAN.md`](./MASTER_PLAN.md) and
[`ROADMAP.md`](./ROADMAP.md)):

| Phase | Theme |  | Phase | Theme |
| :-- | :--- | :-- | :-- | :--- |
| **1** | Deployability & correctness |  | **5** | Testing & quality |
| **2** | Database & data integrity |  | **6** | SEO & performance |
| **3** | Stateless runtime (Redis, outbox, parity) |  | **7** | Observability |
| **4** | Security hardening |  |  |  |

Each gap lists **what is missing**, **why it matters (concrete risk)**, and the
**phase that closes it**.

---

### Gap 1 — The entire Express API is untested
- **Missing:** `server/api.ts` (menu cache-aside, coupons/validate, orders
  list/get, SSE `/realtime/kds`, payment webhook, `/system/metrics`) has **zero
  tests**; nothing asserts the Express adapter and Next agree.
- **Risk:** the two runtimes share services but own separate HTTP layers — a
  change can pass every Next test yet break the POS/KDS path. The Express CORS
  gate also reflects any origin unconditionally — an unverified attack surface.
- **Phase:** **3** (make it testable/parity-safe); suite delivered in **5**.

### Gap 2 — No contract tests between the two runtimes
- **Missing:** nothing asserts both adapters return the same body shape/status for
  the same operation.
- **Risk:** silent divergence. `server/api.ts` has **no order-creation route at
  all** while the Next route does, so there is nothing to diff.
- **Phase:** **3**.

### Gap 3 — No coverage instrumentation or threshold
- **Missing:** `@vitest/coverage-v8` is not installed; no `coverage` block, no
  threshold.
- **Risk:** untested paths (the Express routes) look identical to tested ones;
  reviewers cannot see coverage regressions.
- **Phase:** **5**.

### Gap 4 — No load or performance tests
- **Missing:** no k6, autocannon, or similar.
- **Risk:** the capacity targets (200 orders/min/tenant, p95 read <250 ms) are
  unproven; the first real traffic is in production, during service.
- **Phase:** **6**.

### Gap 5 — No accessibility tests
- **Missing:** no axe-core, no automated a11y assertions.
- **Risk:** accessibility is a stated product commitment; checkout/reservation/
  contact are exactly where regressions hurt and are invisible to functional tests.
- **Phase:** **6**.

### Gap 6 — No Lighthouse CI and no enforced performance budgets
- **Missing:** the perf/SEO budget is a document, not a gate.
- **Risk:** shipped images are ~0.95–2.9 MB and the hero is the LCP element, so
  the 100-Performance goal **already fails by content weight**; without a gate
  every future image regresses it further.
- **Phase:** **6**.

### Gap 7 — No visual regression tests
- **Missing:** no screenshot comparison.
- **Risk:** Tailwind v4 / theme changes can shift layout, spacing or colour in
  ways no functional assertion catches.
- **Phase:** **6**.

### Gap 8 — No concurrency test for idempotency
- **Missing:** the engine is unit-tested, but nothing proves a **parallel burst of
  duplicate keyed submissions yields exactly one order**.
- **Risk:** idempotency exists to survive the simultaneous-arrival race; a
  single-threaded replay test cannot prove the lock works, so a double-charge
  could ship.
- **Phase:** **3** (distributed idempotency); test in **5**.

### Gap 9 — No tenant-isolation / cross-tenant tests
- **Missing:** nothing proves one tenant cannot read another's data — and the
  resolver **fails open**. `lib/db/tenant.ts` returns the **default** tenant for an
  unknown slug; queries use `OR: [{ tenantId }, { tenantId: null }]`.
- **Risk:** a typo'd or malicious slug resolves to the flagship tenant instead of
  erroring, and the `tenantId: null` arm widens every read to unassigned rows —
  a **cross-tenant data-leak** class bug.
- **Phase:** **4** (fail-closed resolution & scoped queries); test in **5**.

### Gap 10 — No IDOR tests on orders, reservations, or loyalty
- **Missing:** nothing proves a caller scoped to tenant A, requesting tenant B's
  id, gets **404**.
- **Risk:** an object reference not re-scoped at read time is direct
  horizontal-privilege-escalation.
- **Phase:** **4**; test in **5**.

### Gap 11 — No test for the price-tampering hole
- **Missing:** `app/api/v1/orders/route.ts:22` accepts a client `price`
  (`z.number().positive()`); `:93-96` sums it into `subtotal`/`total` without
  re-reading `db.dish.price`.
- **Risk:** **direct money loss** — any `orders:write` key can create an order for
  any amount, including ₹0.01 (see [`AUDIT.md`](./AUDIT.md) P0-1).
- **Phase:** **4**; regression test in **4/5**.

### Gap 12 — No test proving `EMAIL_DISPATCH` calls the notifier
- **Missing:** the handler in `lib/queue/handlers.ts:65-74` only **logs** — it
  never calls `lib/email/notifier.ts`.
- **Risk:** order-confirmation emails silently never send, and the "email
  dispatched" log line actively masks the failure.
- **Phase:** **3**.

### ~~Gap 13 — No upload test for the `data:` URL fallback~~ (resolved 2026-10-15)
- **Status:** the `data:` fallback no longer exists. `app/api/upload/route.ts` now
  delegates to `lib/storage/`, and `tests/unit/storage.test.ts` covers driver
  resolution, magic-byte sniffing, size caps, declared-type mismatch, path-traversal
  neutralisation and the local driver write path. Uploads fail closed with `503`
  when no object store is configured.

### Gap 14 — No test for money precision
- **Missing:** totals use float `reduce` in `server/api.ts:118` and
  `app/api/v1/orders/route.ts:93`; no exact-value assertion.
- **Risk:** float accumulation yields totals like `₹647.9700000000001` or
  off-by-a-paise drift; money must be exact (integer paise / Decimal).
- **Phase:** **2**; test in **5**.

### Gap 15 — Shared, serial test database
- **Missing:** `fileParallelism: false` + one shared DB makes the whole run serial
  (~57 s) with file-level coupling.
- **Risk:** runtime grows linearly and ordering coupling becomes a source of
  order-dependent flake; it caps CI throughput.
- **Phase:** **5** (per-worker schema/database isolation; see §13).

---

## 7. Target test strategy

The sections below propose the **target** state. Each is wired into `npm test`/CI
where practical, or a dedicated job where it needs a browser or a running server.

### 7.1 Unit (expand)
Vitest (already present); files under `tests/unit/`. Focus: complete the pure-logic
surface — cost/GST/tax helpers, coupon rules, tenant-slug validation, money
rounding once integerised.

### 7.2 Integration (expand)
Vitest + real Postgres (already present) via `tests/helpers/db.ts`. Add
route-handler tests that call exported `GET`/`POST` functions with crafted
`Request` objects (as the security suite already does for schemas), asserting
status *and* body. Add tenant-scoped service tests once resolution is fail-closed.

### 7.3 Security (expand)
Vitest. Every test must be a *negative* assertion that fails if the guard is
deleted: mass-assignment, injection, cross-tenant reads, IDOR, privilege
escalation, forged signatures/webhooks, price tampering, rate-limit bypass.

### 7.4 Contract (Express ⇄ Next) — **new**
One shared assertion set that both adapters honour the same contract. Tooling:
Vitest importing **both** `server/api.ts` (the app is already exported) and the
Next route handler functions, with the Express app mounted on an ephemeral port.

```ts
// tests/contract/orders-contract.test.ts  (proposed)
import { beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import expressApp from "@/server/api";                 // exported Express app
import { GET as nextListOrders } from "@/app/api/v1/orders/route";
import { createApiKey } from "@/lib/auth/s2s";

let baseUrl: string;
let apiKey: string;

beforeAll(async () => {
  apiKey = (await createApiKey({ name: "contract", scopes: ["orders:read"] })).key;
  const server = expressApp.listen(0);                 // ephemeral port
  await new Promise((r) => server.once("listening", r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  // ... close it in afterAll
});

describe("orders list contract: Express ⇄ Next", () => {
  it("both adapters return the same 200 envelope for a valid key", async () => {
    const headers = { "X-Api-Key": apiKey };
    const expressBody = await (await fetch(`${baseUrl}/api/v1/orders`, { headers })).json();
    const nextBody = await (
      await nextListOrders(new Request("http://localhost/api/v1/orders", { headers }))
    ).json();

    expect(Object.keys(expressBody).sort()).toEqual(Object.keys(nextBody).sort());
    expect(expressBody).toMatchObject({ tenantId: expect.any(String), count: expect.any(Number) });
  });

  it("both adapters reject a key missing the required scope with the same status", async () => {
    const headers = { "X-Api-Key": (await createApiKey({ name: "no-scope", scopes: [] })).key };
    const expressRes = await fetch(`${baseUrl}/api/v1/orders`, { headers });
    const nextRes = await nextListOrders(new Request("http://localhost/api/v1/orders", { headers }));
    expect(expressRes.status).toBe(nextRes.status);
    expect(expressRes.status).toBe(403);
  });
});
```

Runs inside `npm test` — no deployment needed; the Express app is mounted
in-process.

### 7.5 Concurrency & idempotency — **new**
Fire N requests with `Promise.all` sharing one `Idempotency-Key`, then assert
`db.order.count()`.

```ts
// tests/integration/order-idempotency.test.ts  (proposed)
it("parallel duplicates with one Idempotency-Key create exactly one order", async () => {
  const key = `dup-${uniqueSuffix()}`;
  const body = JSON.stringify({ /* valid order payload */ });

  const results = await Promise.all(
    Array.from({ length: 8 }, () =>
      fetch(`${baseUrl}/api/v1/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": apiKey, "Idempotency-Key": key },
        body,
      })
    )
  );

  expect(results.filter((r) => r.status === 201)).toHaveLength(1);   // one create
  expect(await db.order.count({ where: { /* this basket */ } })).toBe(1);
  const bodies = await Promise.all(results.map((r) => r.text()));
  expect(new Set(bodies).size).toBe(1);                             // identical replay
});
```

Only meaningful once idempotency storage is shared (Redis), hence the Phase 3
dependency.

### 7.6 Load — **new** (see §10)
**k6** (scriptable, threshold-based, CI-friendly; autocannon is the lighter
alternative for a single endpoint). Runs in a dedicated job against **staging**,
not the unit job.

### 7.7 Accessibility (axe-core) — **new** (see §11)
`@axe-core/playwright` inside the existing specs; a11y assertions on each public
page; fail on **critical** violations.

```ts
// tests/e2e/a11y.spec.ts  (proposed)
import AxeBuilder from "@axe-core/playwright";

test("homepage has no critical accessibility violations", async ({ page }) => {
  await page.goto("/");
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const critical = violations.filter((v) => v.impact === "critical");
  expect(critical, JSON.stringify(critical.map((v) => v.id))).toEqual([]);
});
```

### 7.8 Visual regression — **new**
Playwright `expect(page).toHaveScreenshot()` with a committed baseline per
project, or a hosted service (Percy/Chromatic) if in-repo baselines become noisy.
Runs under a `@visual` tag so churn does not block logic PRs.

### 7.9 Lighthouse CI — **new** (see §12)
`@lhci/cli` against a built+started server or a preview, in a dedicated job.

### 7.10 Smoke against a deployed environment — **new**
A small `@smoke` Playwright project pointed at `STAGING_URL` via `baseURL`, or a
`scripts/smoke.mjs` hitting `/api/health`, `/`, `/menu` and a read-only
`/api/v1/menu`. Smoke runs are **read-only plus a health probe**; mutating smoke
runs against staging only, never production.

---

## 8. Required new test matrix

| # | Area | Type | Concrete case | Expected result | Phase |
| :-- | :--- | :--- | :--- | :--- | :-- |
| 1 | Pricing | Security/regression | POST order with `price: 0.01` on a ₹249 dish | **422/400**, or **server-recomputed** price — never 0.01 | 4 |
| 2 | Tenant isolation | Security | Tenant A reads Tenant B's resource | **404**; never another tenant's data | 4 |
| 3 | IDOR | Security | Caller scoped to A requests B's order id | **404** | 4 |
| 4 | Unknown slug | Security/integration | Resolve an unknown slug | **Fails closed**; must **not** return the default tenant | 4 |
| 5 | Idempotency | Integration | Same `Idempotency-Key`, different payload | **409 Conflict** | 3 |
| 6 | Idempotency | Integration | Same key, same payload | Replays **stored response**; no second order | 3 |
| 7 | Idempotency | Concurrency | 8 parallel identical submissions, one key | Exactly **one** order; identical bodies | 3 |
| 8 | Email | Integration | Process the outbox so `EMAIL_DISPATCH` runs | **Calls the notifier** (spy), not merely logs | 3 |
| 9 | Degradation | Integration | Redis down mid-request | **200**, cache bypassed, DB result returned | 3 |
| 10 | Data vs index | Integration | Tenant-scoped query returns correct rows | Correct rows. **`EXPLAIN`/index assertions are out of scope for tests** (live in [`DATABASE.md`](./DATABASE.md)) | 2 |
| 11 | Money precision | Unit/integration | Known basket (2×₹249 + ₹99 + 5% GST) | **Exact to the paise**; no float drift | 2/5 |
| 12 | SSE resync | Integration/e2e | KDS disconnects, reconnects | Re-syncs current state; no lost/duplicate tickets | 3 |
| 13 | Contract parity | Contract | `GET /api/v1/orders` on both adapters | Identical envelope + status | 3 |
| 14 | Upload fallback | Integration | Read-only FS, no Blob token | Valid `data:` URL (or clear error); limits enforced | 3 |
| 15 | Coverage gate | CI | `vitest run --coverage` | Fails when floors (§9) not met | 5 |
| 16 | Accessibility | E2E (axe) | Each public page | **Zero critical** violations | 6 |
| 17 | Performance | Lighthouse CI | Home / menu / dish detail | Meets §12 budgets or fails | 6 |
| 18 | Load | k6 | Order write, menu read, SSE fan-out | Meets §10 thresholds | 6 |
| 19 | Visual | Playwright | Key screens vs baseline | No unexpected diff | 6 |
| 20 | Audit | CI | Dependency tree | Zero **high**/critical advisories | 4 |

---

## 9. Coverage policy

There is **no coverage tooling today**. This is a proposal.

### 9.1 Tooling
Install `@vitest/coverage-v8` (the V8 provider, no separate instrumentation step):

```bash
npm i -D @vitest/coverage-v8
```

### 9.2 Config

```ts
// vitest.config.ts (proposed coverage block)
test: {
  coverage: {
    provider: "v8",
    reporter: ["text", "lcov", "json-summary"],
    reportsDirectory: "./coverage",
    include: ["lib/**", "app/**", "server/**"],
    exclude: ["lib/generated/**", "**/*.d.ts", "**/layout.tsx", "tests/**"],
    thresholds: {
      // Global floor — raise gradually, never lower without a written reason.
      lines: 70, functions: 70, branches: 60, statements: 70,
      // Higher floor where the blast radius is largest.
      "lib/services/**": { lines: 80, functions: 80, branches: 70, statements: 80 },
      "lib/auth/**":     { lines: 90, functions: 90, branches: 80, statements: 90 },
    },
  },
},
```

### 9.3 Reporting and gating
- **Local:** `npx vitest run --coverage` prints a text summary; `coverage/lcov`
  feeds IDE gutters.
- **CI:** add `npx vitest run --coverage` to `verify`; the run **fails** when
  thresholds are not met. Optionally upload `coverage/lcov.info` for a PR comment.
- `/coverage` is already git-ignored, so generated output never enters the repo.

### 9.4 Why line coverage is not enough
Line coverage says a line *executed*, not that its behaviour was *checked* — a
test that renders a component and asserts nothing is 100% coverage with zero
confidence. Pair coverage with assertion discipline (§15) and with the
contract/security suites, which catch the classes of bug coverage misses (wrong
values, missing guards, cross-tenant leaks). **Future option:** mutation testing
(e.g. Stryker) flips operators/values and checks whether a test fails; a surviving
mutant is a genuine gap. Adopt it **selectively** on the highest-risk modules
(`lib/services/orders.ts`, `lib/auth/**`, money math) once the floor is stable.

**Choosing the numbers:** global 70/70/60 and services 80 / auth 90 are
**defensible proposals**, not measurements. Auth is highest (a regression is a
security event), services next (the money path), and the global floor sits below
likely current coverage so it starts green and ratchets up.

---

## 10. Performance & load testing plan

No load tooling exists today. This is a proposal.

### 10.1 Tooling
**k6** — scriptable in JS, threshold-based pass/fail, first-class CI support.

```bash
k6 run load/orders.js
docker run --rm -i grafana/k6 run - < load/orders.js
```

### 10.2 Capacity targets to validate (proposed)

| Metric | Target |
| :--- | :--- |
| Order write throughput | **200 orders / min / tenant** sustained |
| API latency (read) | **p95 < 250 ms** |
| API latency (write) | **p95 < 500 ms** |
| Storefront TTFB | **p95 < 200 ms** (cached) |

### 10.3 Scenarios
1. **Menu read (cache-aside):** high-concurrency `GET /api/v1/menu`; validates the
   cache layer and the `X-Cache-Lookup` hit ratio.
2. **Order write burst:** ramp to 200 orders/min/tenant with distinct idempotency
   keys; validates write throughput and connection pooling.
3. **SSE fan-out:** N concurrent KDS subscribers while orders are created;
   validates pub/sub and heartbeat stability.

### 10.4 k6 sketch

```js
// load/orders.js  (proposed)
import http from "k6/http";
import { check } from "k6";
import { uuidv4 } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

const BASE = __ENV.BASE_URL;                 // staging only
const KEY  = __ENV.API_KEY;

export const options = {
  scenarios: {
    menu_read:   { executor: "constant-arrival-rate", rate: 500, timeUnit: "1s",
                   duration: "2m", preAllocatedVUs: 100, exec: "readMenu" },
    order_write: { executor: "constant-arrival-rate", rate: 200, timeUnit: "1m",
                   duration: "3m", preAllocatedVUs: 50,  exec: "writeOrder" },
  },
  thresholds: {
    "http_req_duration{scenario:menu_read}":   ["p(95)<250"],
    "http_req_duration{scenario:order_write}": ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

export function readMenu() {
  check(http.get(`${BASE}/api/v1/menu`), { "menu 200": (r) => r.status === 200 });
}

export function writeOrder() {
  const payload = JSON.stringify({
    customerName: "Load Test", customerEmail: "load@example.com",
    customerPhone: "9999999999", pickupTime: "ASAP",
    items: [{ dishName: "Paneer Tikka", quantity: 1, price: 249 }],
  });
  const res = http.post(`${BASE}/api/v1/orders`, payload, {
    headers: { "Content-Type": "application/json", "X-Api-Key": KEY, "Idempotency-Key": uuidv4() },
  });
  check(res, { "order 201": (r) => r.status === 201 });
}
```

### 10.5 How to run it safely
- **Never against production.** Target **staging** (or a disposable seeded
  environment).
- **Pass/fail is the k6 `thresholds` block** — a non-zero exit fails the CI job.
- **Warm up** the cache/JIT before measuring; discard a short warm-up window.

---

## 11. Accessibility testing plan

### 11.1 Tooling
`@axe-core/playwright` inside the existing Playwright suite — no new runner.

```bash
npm i -D @axe-core/playwright
```

### 11.2 Pages that must pass
Home, **menu**, **dish detail**, **checkout**, **reservations**, **contact**,
**gallery**, **FAQ**, **order tracker**, **admin login**.

```ts
// tests/e2e/a11y.spec.ts  (proposed)
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PAGES = ["/", "/menu", "/reservations", "/contact", "/gallery", "/faq",
               "/order/track", "/admin/login"];

for (const path of PAGES) {
  test(`a11y: ${path} has no critical violations`, async ({ page }) => {
    await page.goto(path);
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const critical = violations.filter((v) => v.impact === "critical");
    expect(critical, `critical on ${path}: ${critical.map((v) => v.id).join(", ")}`)
      .toEqual([]);
  });
}
```

### 11.3 Rules
- **Zero critical violations** is a hard gate; serious/moderate are reported and
  triaged, not silently ignored.
- **Manual checks** automation cannot cover: **keyboard-only** traversal of
  checkout and reservations (reachable, operable, visible focus, no trap);
  **screen reader** pass (NVDA/VoiceOver) on menu → dish → cart and the contact
  form (labels, live-region announcements, announced errors); **contrast** on the
  brand palette and image overlays; **reduced motion** honoured for Framer Motion.

---

## 12. SEO & performance gate plan

Lighthouse CI is not configured today. This is a proposal, consistent with
[`SEO-AND-PERFORMANCE.md`](./SEO-AND-PERFORMANCE.md).

### 12.1 Budget assertions (proposed)

| Category | Assertion |
| :--- | :--- |
| Performance | **≥ 95** (targeting **100**) |
| Accessibility | **= 100** |
| Best Practices | **= 100** |
| SEO | **= 100** |
| LCP (mobile, 4G) | **< 2.0 s** |
| CLS | **< 0.05** |
| INP | **< 200 ms** |
| TTFB (cached) | **< 200 ms** |
| First-load JS | **< 150 KB gzip** |
| Any image | **< 200 KB** |
| Home page total weight | **< 1.0 MB** |

### 12.2 Where it runs
A dedicated GitHub Actions job on `main` and on performance-relevant PRs, against
a built+started server (or a deployed preview), so budgets gate merges.

```yaml
# .github/workflows/lighthouse.yml  (proposed)
name: Lighthouse
on:
  push: { branches: [main] }
  pull_request:
    paths: ["app/**", "components/**", "public/**", "next.config.ts"]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env: { POSTGRES_USER: postgres, POSTGRES_PASSWORD: postgres, POSTGRES_DB: indian_cafe }
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U postgres" --health-interval 5s
          --health-timeout 5s --health-retries 10
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/indian_cafe?schema=public
      AUTH_SECRET: ci-only-secret-never-used-in-production
      APP_URL: http://localhost:3000
      SEED_DEMO_DATA: "true"
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npx prisma generate && npx prisma migrate deploy && npm run db:seed
      - run: npm run build
      - name: Run Lighthouse CI
        run: npx --yes @lhci/cli autorun     # config in lighthouserc.json
```

```jsonc
// lighthouserc.json  (proposed)
{
  "ci": {
    "collect": {
      "startServerCommand": "npx next start -p 3000",
      "url": ["http://localhost:3000/", "http://localhost:3000/menu"],
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:performance":    ["error", { "minScore": 0.95 }],
        "categories:accessibility":  ["error", { "minScore": 1 }],
        "categories:best-practices": ["error", { "minScore": 1 }],
        "categories:seo":            ["error", { "minScore": 1 }],
        "largest-contentful-paint":  ["error", { "maxNumericValue": 2000 }],
        "cumulative-layout-shift":   ["error", { "maxNumericValue": 0.05 }],
        "total-blocking-time":       ["warn",  { "maxNumericValue": 200 }],
        "server-response-time":      ["error", { "maxNumericValue": 200 }],
        "total-byte-weight":         ["error", { "maxNumericValue": 1000000 }],
        "resource-summary:script:size": ["error", { "maxNumericValue": 150000 }]
      }
    },
    "upload": { "target": "temporary-public-storage" }
  }
}
```

> **Honest caveat:** current content weight (~0.95–2.9 MB images, hero as LCP)
> means these budgets **will fail** until images are optimised (Phase 6). The gate
> is deliberately set to the target, not the status quo — it is the forcing
> function.

---

## 13. Test data & fixtures policy

### 13.1 Factories over fixtures
Use **factories** (minimal valid records with unique suffixes) rather than large
static fixtures. `tests/helpers/db.ts` already models this with `makeAdmin`,
`makeCategory`, `dishInput`, `uniqueSuffix` — each test's preconditions stay
visible in the test body with no hidden fixture coupling.

```ts
const category = await makeCategory();
const dish = await db.dish.create({ data: dishInput(category.id, { price: 249 }) });
```

### 13.2 Seeding
- **Unit:** no data.
- **Integration:** each file creates what it needs; `truncateTables(...)`
  (allow-listed, `CASCADE`) resets state **serially** between files.
- **E2E:** a full seed with `SEED_DEMO_DATA=true` (menu, gallery, settings).

### 13.3 Isolation strategy (today vs target)

| Today | Target (Phase 5) |
| :--- | :--- |
| One shared `indian_cafe_test` DB | Per-worker schema or DB |
| `fileParallelism: false` (serial) | `fileParallelism: true` once isolated |
| ~57 s, order-coupled | Parallel, order-independent |

**Migration path that preserves determinism:**
1. Keep `global-setup.ts` creating the DB and running migrations.
2. Give each worker its own **schema** (`test_w0`, …) via `DATABASE_URL?schema=…`,
   or derive a database name from `TEST_WORKER_ID`. `tests/setup/test-db-url.ts`
   already centralises URL derivation — extend it there so no test file changes.
3. Flip `fileParallelism` to `true` **only after** no file depends on another's
   state — audit by running with `--sequence.shuffle` first.
4. Never let isolation weaken determinism: seeds, factories and truncation stay
   scoped to the worker's own schema.

---

## 14. Writing a good test

### 14.1 Do / Don't

| ✅ Do | ❌ Don't |
| :--- | :--- |
| One behaviour per test; a name stating the expectation | A 60-line test asserting five unrelated things |
| Assert **observable outcomes** (return value, DB row, event) | Assert private helpers or exact SQL strings |
| Factories with unique suffixes | Depend on rows another file created |
| Freeze/inject time for time-dependent logic | Assert `createdAt === now` or real opening hours |
| Test the **negative** case in security tests | Only assert the happy path |
| Legible failures (message includes the offending value) | `expect(x).toBeTruthy()` with no context |
| Scope data to the test | Truncate shared tables while other files run |
| Keep E2E to critical journeys | Re-test every validation rule in a browser |

### 14.2 Worked example A — a good integration test

`suggested path: tests/integration/orders.test.ts`

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db/prisma";
import { createOrder, getOrderById } from "@/lib/services/orders";
import { dishInput, makeCategory, truncateTables, uniqueSuffix } from "../helpers/db";

// Behaviour under test: createOrder persists an order with server-authoritative
// pricing; getOrderById reads it back.
describe("orders service", () => {
  let dishId: string;

  beforeAll(async () => {
    await truncateTables("Order", "OrderItem", "Dish", "Category");
    const category = await makeCategory();
    dishId = (await db.dish.create({ data: dishInput(category.id, { price: 249 }) })).id;
  });

  afterAll(async () => {
    await truncateTables("Order", "OrderItem", "Dish", "Category");
  });

  it("creates an order whose totals are derived from the stored dish price", async () => {
    const order = await createOrder({
      customerName: "Asha R.",
      customerEmail: `asha-${uniqueSuffix()}@test.example`,
      customerPhone: "9876543210",
      pickupTime: "ASAP",
      items: [{ dishId, quantity: 2 }], // quantity only — no client price
    });

    expect(order.orderNumber).toMatch(/^ORD-/);
    expect(Number(order.subtotal)).toBe(498);  // 2 × ₹249
    expect(Number(order.total)).toBe(522.9);   // +5% GST

    const persisted = await getOrderById(order.id);
    expect(persisted?.items).toHaveLength(1);
    expect(Number(persisted?.items[0].price)).toBe(249); // server price, not client
  });
});
```

Why it is good: real SQL and transactions, a *business* outcome (pricing +
persistence), a unique email so it never collides, and visible preconditions.

### 14.3 Worked example B — a security test that asserts the negative

`suggested path: tests/security/tenant-isolation.test.ts`

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db/prisma";
import { createApiKey } from "@/lib/auth/s2s";
import { GET as getOrderRoute } from "@/app/api/v1/orders/[id]/route";
import { truncateTables, uniqueSuffix } from "../helpers/db";

// Security property: a caller scoped to tenant A must NEVER read tenant B's data.
// Fails loudly if tenant scoping is removed at read time.
describe("tenant isolation", () => {
  let orderInB: string;
  let keyForA: string;

  beforeAll(async () => {
    await truncateTables("Order", "OrderItem", "Tenant");
    const [a, b] = await Promise.all([
      db.tenant.create({ data: { slug: `tenant-a-${uniqueSuffix()}`, name: "A", isActive: true } }),
      db.tenant.create({ data: { slug: `tenant-b-${uniqueSuffix()}`, name: "B", isActive: true } }),
    ]);

    orderInB = (await db.order.create({
      data: {
        tenantId: b.id, orderNumber: `ORD-${uniqueSuffix()}`,
        customerName: "Tenant B Guest", customerEmail: "b@test.example",
        customerPhone: "9000000001", pickupTime: "ASAP",
        subtotal: 100, tax: 5, discount: 0, total: 105,
        orderStatus: "PENDING", paymentStatus: "PENDING",
      },
    })).id;

    keyForA = (await createApiKey({ name: "tenant-a-key", tenantId: a.id, scopes: ["orders:read"] })).key;
  });

  afterAll(async () => {
    await truncateTables("Order", "OrderItem", "Tenant");
  });

  it("returns 404 (not the row) when tenant A requests tenant B's order id", async () => {
    const res = await getOrderRoute(
      new Request(`http://localhost/api/v1/orders/${orderInB}`, {
        headers: { "X-Api-Key": keyForA },
      }),
      { params: Promise.resolve({ id: orderInB }) }
    );

    expect(res.status).toBe(404);                                  // cross-tenant = miss
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain("Tenant B Guest");  // no leakage
  });
});
```

Why it is good: it asserts the **negative** (404 + no leaked field) with two real
tenants, so removing the tenant filter makes it fail — exactly what a security
test must guarantee.

---

## 15. Definition of done for tests

Aligned with [`../CONTRIBUTING.md`](../CONTRIBUTING.md) ("A change is not complete
without tests") and [`../SECURITY.md`](../SECURITY.md).

| Change type | Required test |
| :--- | :--- |
| New domain/service function | Unit test in `tests/unit/` |
| New API route or Server Action | Integration test in `tests/integration/` |
| New user-facing flow | Playwright spec in `tests/e2e/` |
| Auth, payments, or tenant logic | Unit **and** security test |
| Bug fix | Regression test that **fails before** and **passes after** |
| New Express/Next route pair | Contract test in `tests/contract/` (target) |
| Money math change | Unit test with an exact paise-level assertion |
| New UI surface | axe-core assertion on the page (target) |
| New page/asset | Lighthouse budget must still pass (target) |

**Global rules (from CONTRIBUTING):** tests must be **deterministic** (no
wall-clock dependence, no random ordering, no shared mutable state across files);
test **behaviour and contracts, not implementation**; **never weaken or delete an
assertion** to make a suite pass.

**Per-change checklist:**
1. Touches money, auth, or tenancy? → a security test exists.
2. Adds a route? → an integration test asserts status *and* body.
3. Bug fix? → I can show the test failing on the pre-fix commit.
4. Touched time, randomness, or shared tables? → still deterministic and
   order-independent.
5. New page or asset? → budgets/a11y still hold.

---

## 16. Further reading & related documents

Companion documents in this folder (some are still being written; where a target
doc is referenced below it is the intended home for that detail):

- [`./MASTER_PLAN.md`](./MASTER_PLAN.md) — the engineering master plan, phases and
  north-star principles this strategy serves.
- [`./AUDIT.md`](./AUDIT.md) — the audit that produced the phase-0/1 findings
  (e.g. P0-1 client-controlled pricing) this document turns into regression tests.
- [`./ROADMAP.md`](./ROADMAP.md) — phased delivery (every gap maps to a phase).
- [`./ARCHITECTURE.md`](./ARCHITECTURE.md) — the two-runtime topology that makes
  contract testing necessary.
- [`./DATABASE.md`](./DATABASE.md) — schema, migrations and indexing strategy
  (index/`EXPLAIN` verification lives there, not in tests).
- [`./SEO-AND-PERFORMANCE.md`](./SEO-AND-PERFORMANCE.md) — the performance budget
  §12 operationalises into Lighthouse CI.
- [`../CONTRIBUTING.md`](../CONTRIBUTING.md) — quality gates and testing
  requirements for every change.
- [`../SECURITY.md`](../SECURITY.md) — security commitments and the deployment
  hardening checklist.

**Status of this document:** the inventory in §2 and the CI description in §5 are
**measured against the repository on 2026-10-15**. All target sections (§7–§13)
are **proposals**; adopt each by landing its gate in CI and updating the relevant
row from "proposed" to "enforced".

---

© 2026 Himanshu. All Rights Reserved.
