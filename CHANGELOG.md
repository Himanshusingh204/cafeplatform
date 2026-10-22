# Changelog

All notable changes to the Spice & Saffron platform are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Site polish and CI

- Professional footer; new Help, Cookies, Refunds and Accessibility pages; sitemap, robots, manifest, PWA icons and `security.txt`.
- Accessibility and SEO audited to 100 on Lighthouse mobile; images cached for a week.
- Order inventory and loyalty steps are atomic and retried through the outbox.
- CI: Lighthouse no longer passes the invalid `preset: mobile` (mobile is the default); CI sets `ALLOW_IN_MEMORY_STATE` because production start needs Redis otherwise.
- README: screenshots added and test counts corrected.

### Hardening round (review follow-ups)

- API-key `ipAllowlist` is now enforced; Express derives the caller address from `req.ip` (`TRUST_PROXY_HOPS`).
- Admin order actions, list, stats and the KDS stream are scoped to the admin's tenant; order-time dish lookups are tenant-scoped.
- Payment webhooks reject captures on cancelled/completed orders or with a mismatched amount (logged at error) and claim the order atomically.
- Storefront no longer sends its own receipt (the outbox does); in-flight idempotency lock capped at 120 s.
- Suite: 56 files, 388 tests; production build verified with `ALLOW_DEFAULT_TENANT=true`.

### Multi-tenant completeness and plans (Phase 2 and 9 slice, W5)

- Migration `20261023090000_tenant_scope_remaining`: `tenantId` (NOT NULL, FK `ON DELETE RESTRICT`) on
  `GalleryImage`, `ContactMessage`, `Review`, `Setting`, `Coupon`; `Category`/`Dish` `tenantId` made NOT NULL.
  Expand, backfill to the default tenant (created only if orphan rows exist), constrain. AUDIT P2-4.
- Migration `20261023100000_per_tenant_uniques`: `(tenantId, slug)` on `Category`/`Dish`, `(tenantId, code)` on
  `Coupon`, `(tenantId, key)` on `Setting` replace the global uniques. AUDIT P2-5.
- Migration `20261023110000_tenant_plan_tier`: `Tenant.plan` enum (`FREE`, `STARTER`, `PRO`), default `STARTER`.
- Services, admin actions, pages, the contact route, the notifications stream and the public actions are tenant-scoped;
  admins act on `Admin.tenantId` (falling back to the default tenant) via `lib/auth/tenant-context.ts`.
  `SessionAdmin` now carries `tenantId`.
- `lib/db/tenant.ts`: 60 s in-process cache for slug/id lookups, `updateTenant`/`invalidateTenant`/`clearTenantCache`;
  the read path no longer writes, and the explicit default slug is only bootstrapped where the default tenant is
  allowed. AUDIT P2-6.
- `lib/plans`: typed `PLAN_LIMITS`, `assertWithinPlan`, `PlanLimitError` (HTTP 402 / `plan_limit_exceeded`), enforced on
  dish, gallery image, API key and monthly order creation; usage shown on the admin settings page.
- Seed creates the flagship tenant and owns every seeded row. New tests: tenant cache, plan limits, tenant isolation.

### SEO and performance (Phase 6, W2)

- `lib/seo/metadata.ts` `pageMetadata()` gives every public page unique title, description, canonical, Open Graph
  and Twitter metadata; home, loyalty and waitlist now export metadata; `/order/[id]` is noindex.
- JSON-LD for `/faq` and `/menu/[slug]` now uses the typed builders in `lib/seo/jsonld.ts` (FAQPage, MenuItem,
  BreadcrumbList) and `serializeJsonLd` (escapes `<`). Unit tests in `tests/unit/seo-jsonld.test.ts`.
- All raster images under `public/images` re-encoded (28 MB to 4.2 MB); page assets are under 200 KB. The
  optimiser script no longer fails on Windows (sharp cache disabled).
- Heading font declared with `display: "swap"` on both `next/font` families.

### Observability (Phase 7, partial)

- `GET /api/ready` (and Express `/ready`) readiness probe: Postgres, Redis, outbox backlog; 503 only
  when Postgres is down. `/api/health` remains dependency-free liveness; Express health moved to
  `server/routes/health.ts`.
- `lib/observability`: AsyncLocalStorage request context, secret/PII redaction in `logger`, dependency-free
  Prometheus metrics, `GET /api/metrics` (bearer `METRICS_TOKEN`, 404 when unset) with outbox depth/lag/dead
  gauges; order and outbox counters wired. `apiError` logs 5xx with `requestId`. Runbooks in OPERATIONS section 20.

### Quality gates (Phase 5, partial)

- `@vitest/coverage-v8` and `@axe-core/playwright` added; coverage thresholds (lines 55) in `vitest.config.ts`.
- `tests/e2e/a11y.spec.ts` (axe, light and dark); `lighthouserc.json`; CI gains coverage artifact,
  non-blocking prod-dependency audit, gitleaks and a non-blocking Lighthouse job.
- New pure unit tests for error bodies, outbox backoff and request-guard helpers.

### Runtime state (Phase 3, partial)

- Durable outbox: `OutboxEvent` model + migration `20261022090000_outbox_events`; `lib/outbox`
  (`enqueueOutboxEvent`, `processOutbox` using `FOR UPDATE SKIP LOCKED`, exponential backoff,
  DEAD after 6 attempts). `createOrder` writes the receipt event in the order transaction.
- `GET /api/cron/outbox` (bearer `CRON_SECRET`, constant-time; 503 in production if unset) and
  a `vercel.json` cron; opportunistic `after()` drain post-order.
- Redis cache invalidation uses `SCAN` instead of `KEYS` (P1-3); queue metrics are real
  counters (P2-7); Express KDS broadcast publishes the tenant UUID (P2-8).

### Database / tenancy (Phase 2)

- `resolveTenant` fails closed (P0-3): throws `TenantResolutionError` for unknown/inactive slugs and,
  in production, when no tenant is given unless `ALLOW_DEFAULT_TENANT=true`.
- Migration `20261021120000_tenant_hardening`: `Order.tenantId` backfilled and `NOT NULL`
  (FK now `ON DELETE RESTRICT`); `Tenant.taxRatePercent` (nullable) and `Tenant.currency` added
  (P1-7 / D1). `createOrder` resolves the order's tenant and applies its tax rate.

### Security

- CORS on the standalone API now uses an explicit allow-list from `APP_URL`, `CLIENT_URL` and
  `ALLOWED_ORIGINS` (`server/middleware/cors.ts`); no wildcard with credentials (P1-1).
- S2S `lastUsedAt` is written at most once per 60 s per key (P1-5); key digests are confirmed
  with `crypto.timingSafeEqual` and the misleading comment is corrected (P1-6).
- Loyalty lookup validates input with zod and is verified authenticated-by-purchase, rate limited
  and read-only (P1-10).
- Login throttles by IP before parsing the body; logout and upload check the request Origin; the
  order and waitlist id params are validated; error logs no longer carry full error objects.

### Added

- `server/app.ts`: the Express app, exported without listening. `server/api.ts` is now only
  the process entry. `server/routes/` holds the menu and orders routers and the S2S adapter.
- `POST /api/v1/orders` on the Express adapter, with the same validation, rate limit,
  scoped idempotency and error mapping as the Next route, delegating to `createOrder`.
- `getApiMenuCatalog` in `lib/services/menu.ts`: one tenant-scoped, cached menu catalog used by
  both adapters.
- `tests/parity/`: adapter parity smoke tests (status and body shape, Next vs Express).
- `.github/dependabot.yml`; `test:parity` and `test:coverage` scripts and a vitest coverage block
  (requires `@vitest/coverage-v8`, see `docs/TESTING.md`).

- `LICENSE` — proprietary, source-available license with a personal-use grant
  and a commercial-licensing requirement.
- `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`.
- `docs/` engineering documentation set: master plan, architecture, database and
  indexing strategy, audit report, roadmap, operations runbook, testing
  strategy and SEO/performance plan.
- `docs/plans/phase-1-completion.md` — the reviewable execution plan for the
  remainder of Phase 1, with the evidence behind each decision and the open
  questions.
- `lib/api/request-guards.ts` — reusable Route Handler guards: idempotency-key
  parsing, payload fingerprinting, tenant+operation key namespacing, distributed
  backend detection and the acquire/complete/release wrappers over
  `globalIdempotency` and `rateLimit`.
- `scripts/vercel-build.mjs` — the Vercel build entrypoint: applies migrations for
  production builds only, then builds. Supports `--check` to print the plan
  without running it.
- Copyright and licensing notices across the project.

### Changed

- Express `GET /api/v1/menu` now requires an S2S key with `menu:read` and returns the same
  tenant-scoped body as the Next route (it was unauthenticated and returned a different shape).
  Prices in that body are numbers rather than Decimal strings.

- `README.md` fully rewritten for GitHub rendering, factual accuracy and
  licensing clarity.
- `.gitignore` updated so the public `docs/` set is tracked, while internal
  notes remain private.
- **Phase 1 — deployability & correctness (in progress).** All order creation,
  coupon, loyalty, inventory-depletion, station-routing and tenant-assignment
  logic now flows through the shared `lib/services/orders.ts`, so the Next.js
  Route Handler and any future adapter cannot diverge.
- `generateOrderNumber()` now returns `ORD-YYMMDD-XXXXXX` (Crockford base32)
  instead of `ORD-####`, and order creation retries on a unique-constraint
  violation. The previous scheme had only 9 000 values and could collide on a
  globally-unique column.
- The `EMAIL_DISPATCH` job handler now sends through the transactional email
  notifier instead of only logging, and throws on provider failure so the queue
  retries with backoff and dead-letters. It is a logged no-op when no provider
  is configured.
- `createOrder` accepts and persists an explicit `tenantId`, and sends the
  customer receipt best-effort after the order is committed.
- **Uploads now use object storage.** A new `lib/storage/` abstraction with a
  vendor-neutral S3-compatible driver (`@aws-sdk/client-s3`) replaces the
  Vercel-Blob → filesystem → `data:`-URL cascade. Local development uses a
  filesystem driver under `public/uploads` (git-ignored); production requires
  `STORAGE_*` and fails closed with `503` when unconfigured.
- `next.config.ts` reads `STORAGE_PUBLIC_URL` at build time to authorise
  `next/image` remote patterns and the CSP `img-src`.
- **`POST /api/v1/orders` is now retry-safe and rate limited.** A caller that
  sends `Idempotency-Key` gets exactly-once semantics: a repeated key returns the
  original `201` body, a concurrent duplicate returns `409`, and reusing a key
  for a different body returns `409` instead of booking a second order. Requests
  are throttled per API key at 60 per rolling minute (`429` + `Retry-After`).
  Because per-instance memory cannot deduplicate across serverless instances, the
  route returns `503` in production when no shared backend (`UPSTASH_*`) is
  configured rather than silently accepting duplicates.
- `server/middleware/idempotency.ts` stored responses may now carry an internal
  `meta` map (`lib/resilience/idempotency.ts`). It is never replayed to clients;
  it records the payload fingerprint used for conflict detection.
- Express CORS now permits the `Idempotency-Key` request header.
- **Deployment no longer migrates the production database from preview builds.**
  `vercel.json` previously ran `prisma migrate deploy && next build` on every
  deployment, including previews, which frequently share `DATABASE_URL` with
  production. The build now runs `scripts/vercel-build.mjs`, which applies
  migrations only when `VERCEL_ENV` is not `preview`/`development` and prints its
  plan to the build log.
- The full test suite now stands at **192 tests across 31 files** (feature work
  in workstream A added no tests; it is verified by the deployment verifier).

### Removed

- The `@vercel/blob` import (never installed) and the `BLOB_READ_WRITE_TOKEN`
  environment variable. Superseded by the storage driver above.

### Fixed

- Removed README links to files that are intentionally git-ignored, which
  previously produced 404s on GitHub.

### Security

- **Order pricing is now authoritative on the API.** `app/api/v1/orders/route.ts`
  previously computed the subtotal from a client-supplied `price`; it now
  delegates to `createOrder`, which reads the catalog price from the database and
  ignores the client value. A tampered price is overridden or the request is
  rejected — it is never trusted.
- **Uploads are validated, not trusted.** Image bytes are identified by magic
  number, checked against the declared type, capped at 5 MB and 8 000 px, and
  re-encoded with `sharp` to strip EXIF/GPS metadata. Object keys are randomised
  and path-traversal-safe. Binary is never persisted in PostgreSQL.
- **Duplicate orders are rejected, not merged.** Order ingestion fails closed
  when the idempotency/rate-limit backend is unavailable in production, treats an
  `Idempotency-Key` as bound to one tenant, one endpoint and one request body,
  and never replays one tenant's response to another tenant's key.
- **A preview deployment can no longer migrate production.** Migrations are
  applied by `scripts/vercel-build.mjs` for production builds only; the decision
  is logged in the build output.
- **The API surface is verified after deploy.** `npm run verify:prod` asserts that
  `/api/v1/menu` and `/api/v1/orders` answer `401` (not `404`) without
  credentials, and that the public waitlist route answers with its own JSON
  `404` — proving the Route Handlers are deployed rather than silently missing.
- Recorded a new audit finding, **P1-10**: `GET /api/v1/loyalty/profile?email=…`
  is unauthenticated, unlimited, and creates customer records on an unknown
  address. Fix scheduled for Phase 4; see `docs/AUDIT.md`.

---

## [0.2.2] — 2026-09 (Phase 2.2, in progress)

### Added

- Kitchen **stations** (`HOT_KITCHEN`, `TANDOOR`, …) with per-station order item
  routing and bumping.
- **Inventory** management: ingredients, recipes, stock levels, par levels and
  automatic 86-ing of dishes whose recipe cannot be fulfilled.
- **Floor plan and tables**: `DiningTable` with layout coordinates, shape,
  capacity, status and current-order linkage.
- **Waitlist**: entry capture, notification state and seating transitions.
- **Loyalty**: `CustomerUser` accounts, points ledger, tier progression and
  lifetime spend tracking.
- **Public loyalty** and **waitlist** experiences, plus their `/api/v1` routes.

### Changed

- KDS board renders and advances tickets per kitchen station.

---

## [0.2.1] — 2026-09

### Added

- Dish **modifiers** and modifier groups with price deltas.
- **Dine-in** ordering mode with table numbers and QR entry points.
- **Tipping** support on orders.
- **Operating hours** service and scheduling.
- **Thermal chit** generation for kitchen printing.

---

## [0.2.0] — 2026-09 — Enterprise Resilience

### Added

- **Idempotency engine** for mutating endpoints, with cached replay of
  successful responses and `409 Conflict` on in-flight collisions.
- **Cache-aside manager** with a Redis backend and an in-memory fallback.
- **Asynchronous job queue** with exponential backoff retries and a dead-letter
  queue.
- **Database query telemetry**, warning on queries slower than 150 ms.
- **Distributed rate limiting** with a sliding window.

### Security

- Patched client-side price tampering.
- Patched a payment-bypass path.
- Mitigated coupon-code dictionary enumeration.
- Corrected IP extraction for rate limiting behind proxies.

---

## [0.1.0] — 2026-08 — Foundation

### Added

- Multi-tenant Prisma schema for tenants, admins, categories, dishes, orders,
  reservations, reviews, messages, coupons and settings.
- Argon2id password hashing and SHA-256-hashed session tokens.
- Role-based access control: `SUPER_ADMIN`, `ADMIN`, `EDITOR`.
- S2S API keys with scoped access and constant-time verification.
- HMAC-verified, idempotent payment webhook ingress.
- Real-time Kitchen Display System over Server-Sent Events.
- Customer storefront: home, menu, dish detail, checkout, reservations,
  gallery, about, contact, FAQ, privacy and terms.
- Admin CMS: dashboard, dishes, categories, orders, reservations, reviews,
  coupons, messages, gallery, developers, activity and settings.
- SEO baseline: metadata, Open Graph, Twitter cards, `Restaurant` JSON-LD,
  `robots.txt` and a dynamic `sitemap.xml`.
- Security headers and a Content-Security-Policy via `next.config.ts`.
- Vitest unit/integration/security suites and Playwright end-to-end flows.

---

© 2026 Himanshu. All Rights Reserved.
