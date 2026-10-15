# Changelog

All notable changes to the Spice & Saffron platform are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
