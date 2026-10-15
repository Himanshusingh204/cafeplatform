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

### Fixed

- Removed README links to files that are intentionally git-ignored, which
  previously produced 404s on GitHub.

### Security

- **Order pricing is now authoritative on the API.** `app/api/v1/orders/route.ts`
  previously computed the subtotal from a client-supplied `price`; it now
  delegates to `createOrder`, which reads the catalog price from the database and
  ignores the client value. A tampered price is overridden or the request is
  rejected — it is never trusted.

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
