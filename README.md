<div align="center">
  <h1>Spice &amp; Saffron</h1>
  <p><strong>Multi-tenant Indian café &amp; restaurant platform</strong><br />
  Storefront &middot; Ordering &amp; payments &middot; Kitchen display &middot; Reservations &middot; Loyalty &middot; Admin CMS</p>
  <p>
    <a href="https://nextjs.org/"><img alt="Next.js 16.3" src="https://img.shields.io/badge/Next.js-16.3-000000?logo=nextdotjs&amp;logoColor=white&amp;style=for-the-badge" /></a>
    <a href="https://react.dev/"><img alt="React 19" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&amp;logoColor=black&amp;style=for-the-badge" /></a>
    <a href="https://www.typescriptlang.org/"><img alt="TypeScript 5" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&amp;logoColor=white&amp;style=for-the-badge" /></a>
    <a href="https://tailwindcss.com/"><img alt="Tailwind CSS v4" src="https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss&amp;logoColor=white&amp;style=for-the-badge" /></a>
  </p>
  <p>
    <a href="https://www.prisma.io/"><img alt="Prisma 7" src="https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&amp;logoColor=white&amp;style=for-the-badge" /></a>
    <a href="https://www.postgresql.org/"><img alt="PostgreSQL 18" src="https://img.shields.io/badge/PostgreSQL-18-4169E1?logo=postgresql&amp;logoColor=white&amp;style=for-the-badge" /></a>
    <a href="https://nodejs.org/"><img alt="Node 20.19 or newer" src="https://img.shields.io/badge/Node-%E2%89%A520.19-339933?logo=nodedotjs&amp;logoColor=white&amp;style=for-the-badge" /></a>
    <a href="https://vitest.dev/"><img alt="192 tests passing" src="https://img.shields.io/badge/tests-192%20passing-brightgreen?logo=vitest&amp;logoColor=white&amp;style=for-the-badge" /></a>
  </p>
  <p>
    <a href="./LICENSE"><img alt="License: Proprietary (personal use only)" src="https://img.shields.io/badge/license-Proprietary%20%C2%B7%20personal%20use%20only-red?style=for-the-badge" /></a>
    <a href="https://github.com/Himanshusingh204/cafeplatform/actions/workflows/ci.yml"><img alt="CI status" src="https://github.com/Himanshusingh204/cafeplatform/actions/workflows/ci.yml/badge.svg" /></a>
  </p>
</div>

[Overview](#overview) · [Features](#feature-set) · [Architecture](#architecture) · [Getting Started](#getting-started) · [API](#api-surface) · [Testing](#testing--quality) · [Docs](#documentation) · [Roadmap](#roadmap) · [Limitations](#current-limitations) · [License](#license)

---

## Overview

**Spice & Saffron** is a full-stack, multi-tenant platform for running an Indian café or restaurant end to end: a customer-facing storefront with menu, cart, checkout and order tracking; a kitchen display system (KDS) that streams tickets in real time; a role-based admin CMS for the menu, content, reservations, inventory, loyalty and reporting; and a machine-to-machine (S2S) API for POS systems and delivery aggregators.

The codebase is organised around a single, shared domain layer (`lib/services/*`) that is consumed by two thin runtime adapters:

- **Next.js Route Handlers** (`app/api/v1/*`) — the primary production API on Vercel.
- **Express** (`server/api.ts`, port 4000) — retained for self-hosting, long-running workers and local development.

Both adapters talk to the same services, the same Prisma schema and the same PostgreSQL database, so the two runtimes cannot drift.

> **A note on honesty.** This README describes the system as it exists today, including the parts that are not finished. Several production-critical items are still open (in-process state, tenant isolation, uploads, transactional email, the un-deployed Express API). These are listed concretely under [Current Limitations](#current-limitations) and tracked in [`docs/AUDIT.md`](./docs/AUDIT.md) and [`docs/ROADMAP.md`](./docs/ROADMAP.md). Nothing here is aspiration dressed up as fact.

---

## Feature Set

### Customer storefront

- **Menu** with categories, dietary and allergen metadata (vegetarian, vegan, spicy, contains nuts), per-dish modifiers and prep time.
- **Cart, checkout and coupons** with discount validation and a choice of payment methods.
- **Payments** via Razorpay and Stripe, plus pay-at-pickup, with HMAC-SHA256-verified webhooks.
- **Live order tracking** across four stages (Confirmed → In Preparation → Ready → Completed).
- **Reservations** with slot availability and a shareable reference code.
- **Loyalty programme** with points, tiers and a transaction ledger.
- **Waitlist** management and a **floor-plan** view of dining tables.
- **Reviews, gallery, FAQ, contact and legal pages.**

### Kitchen & operations

- **Kitchen display system** (`/admin/kds`) with SSE-fed tickets, per-station routing (hot kitchen, tandoor, cold, bar, dessert) and colour-coded elapsed timers.
- **Admin CMS** with a three-tier RBAC hierarchy: `SUPER_ADMIN` > `ADMIN` > `EDITOR`.
- **Menu, coupon, reservation and message management**, inventory with recipe-driven auto-86, and an activity audit log.

### Platform & integrations

- **S2S API keys** (`sp_live_...`) with scopes and per-key allowlists for POS and aggregator integrations.
- **Outbound webhooks** with signed payloads and delivery records.
- **Multi-tenant** data model with per-tenant slugs and custom-domain resolution.
- **SEO**: metadata, Open Graph/Twitter cards, dynamic `sitemap.xml`, `robots.txt` and JSON-LD structured data.

---

## Architecture

The platform is a layered system: an edge/CDN layer, a Next.js presentation and application layer, a shared domain layer, and an infrastructure layer over PostgreSQL and (in production) Redis.

```mermaid
flowchart TD
    subgraph Clients["Clients"]
        Cust["Customer browser"]
        Admin["Admin &amp; kitchen staff"]
        Partner["POS / aggregator partner"]
    end

    subgraph Edge["Edge / CDN"]
        CDN["Vercel edge &amp; CDN<br/>TLS, caching, static assets"]
    end

    subgraph Next["Next.js 16 — presentation &amp; application"]
        RSC["React 19 Server Components<br/>SSR / ISR storefront"]
        Actions["Server Actions<br/>RBAC-guarded admin mutations"]
        RH["Route Handlers<br/>app/api/v1/* — primary API"]
        Proxy["proxy.ts<br/>admin gate + headers"]
    end

    subgraph Express["Express 5 — self-host / workers"]
        EAPI["server/api.ts (port 4000)<br/>REST + SSE + webhooks"]
        Worker["Background worker<br/>jobs, outbox drain"]
    end

    subgraph Domain["Domain layer"]
        Services["lib/services/*<br/>orders, catalog, reservations,<br/>loyalty, inventory, tables"]
    end

    subgraph Infra["Infrastructure"]
        Auth["Auth: Argon2id, sessions, S2S keys"]
        Cache["Cache &amp; rate limit"]
        Realtime["Realtime pub/sub"]
        Payments["Payments: Razorpay / Stripe"]
        Mail["Email: transactional notifier"]
        Storage["Object storage"]
    end

    subgraph Data["Data"]
        PG[("PostgreSQL 18")]
        Redis[("Redis")]
        Blob[("Blob store")]
    end

    Cust --> CDN --> RSC
    Admin --> CDN --> Actions
    Admin --> Proxy
    Partner -->|"Bearer sp_live_..."| RH
    Partner -->|"Bearer sp_live_..."| EAPI

    RSC --> Services
    Actions --> Services
    RH --> Services
    EAPI --> Services
    Worker --> Services

    Services --> Auth
    Services --> Cache
    Services --> Realtime
    Services --> Payments
    Services --> Mail
    Services --> Storage

    Services --> PG
    Cache --> Redis
    Realtime --> Redis
    Storage --> Blob
```

**Runtime placement.** Next.js Route Handlers are the production API because the deploy target (Vercel) has no long-lived port 4000. The Express service is kept for self-hosted deployments, long-running background work and fast local iteration. See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the full data-flow, networking and scaling design, and [`docs/adr/0001-vnext-route-handlers-as-primary-api.md`](./docs/adr/0001-vnext-route-handlers-as-primary-api.md) for the decision record.

**Domain model (excerpt).** The schema has 26 models covering tenancy, catalog, ordering, dining room, kitchen, inventory, loyalty, content and integrations.

```mermaid
erDiagram
    Tenant ||--o{ Category : owns
    Tenant ||--o{ Dish : serves
    Tenant ||--o{ Order : processes
    Tenant ||--o{ Reservation : hosts
    Tenant ||--o{ DiningTable : has
    Tenant ||--o{ CustomerUser : serves
    Tenant ||--o{ ApiKey : issues
    Tenant ||--o{ Admin : employs

    Category ||--o{ Dish : contains
    Dish ||--o{ OrderItem : "ordered as"
    Order ||--o{ OrderItem : contains
    OrderItem ||--o{ OrderItemModifier : "has"
    Dish ||--o{ DishModifierGroup : "has"
    DishModifierGroup ||--o{ DishModifierOption : contains
    Dish ||--o{ RecipeItem : "made from"
    Ingredient ||--o{ RecipeItem : "used in"
    Admin ||--o{ Session : authenticates
    CustomerUser ||--o{ LoyaltyLedger : accrues
    Order ||--o| LoyaltyLedger : earns
```

See [`docs/DATABASE.md`](./docs/DATABASE.md) for the complete model, indexing strategy and data-handling rules.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| Framework | Next.js 16.3 (App Router, RSC, ISR, Server Actions) |
| UI | React 19.2, Tailwind CSS v4, `class-variance-authority`, `lucide-react`, `framer-motion` |
| Language | TypeScript 5 (strict) |
| Data | PostgreSQL 18, Prisma 7.9 (`@prisma/adapter-pg`), Redis (production) |
| API | Next.js Route Handlers + Express 5 (self-host), Zod 4 validation |
| Auth | Argon2id passwords, SHA-256-hashed session tokens, scoped S2S API keys |
| Payments | Razorpay, Stripe (HMAC-verified webhooks) |
| Email | Transactional notifier over an HTTP email API |
| Tests | Vitest 4 (unit/integration/security), Playwright (E2E) |
| Tooling | ESLint 9, Prettier-free config, `tsx`, `concurrently` |

---

## Getting Started

### Prerequisites

- **Node.js** `>= 20.19` (CI uses Node 22 — see `.nvmrc`)
- **npm** `>= 10`
- **PostgreSQL** `>= 14` (18 recommended)

### 1. Clone and install

```bash
git clone https://github.com/Himanshusingh204/cafeplatform.git
cd cafeplatform
npm install
```

### 2. Configure the environment

```bash
cp .env.example .env.local
```

Set at minimum:

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/indian_cafe?schema=public"

# Session secret — generate with: openssl rand -base64 32
AUTH_SECRET="your-32-byte-random-secret"

# App origin (must match the origin you serve from — CSRF checks depend on it)
APP_URL="http://localhost:3000"

# Self-hosted API (only needed for npm run dev:server / dev:all)
API_PORT="4000"
NEXT_PUBLIC_API_URL="http://localhost:4000"
```

Optional integrations (payments, email, object storage, Redis) are all documented in [`.env.example`](./.env.example) and in the [configuration reference](./docs/OPERATIONS.md#7-environment-variable-reference).

### 3. Initialise the database

```bash
npx prisma migrate deploy
npm run db:seed
```

Set `SEED_DEMO_DATA="true"` in `.env.local` to seed a full demo catalog, categories and reviews.

### 4. Create an admin account

```bash
ADMIN_EMAIL="admin@spiceandsaffron.in" \
ADMIN_PASSWORD="ChangeMe123!" \
ADMIN_NAME="Owner" \
ADMIN_ROLE="SUPER_ADMIN" \
npm run create-admin
```

### 5. Run

```bash
npm run dev        # Next.js only (http://localhost:3000)
npm run dev:all    # Next.js + Express API (http://localhost:3000 and :4000)
```

- Storefront & admin CMS — <http://localhost:3000>
- Admin login — <http://localhost:3000/admin/login>
- Express API health — <http://localhost:4000/health>

---

## Configuration

Everything that varies between environments is configuration, not hardcoded values — site identity, contact details, opening hours and SEO defaults live in `config/site.ts` and `config/seo.ts`, and everything environment-specific lives in environment variables.

| Variable | Required | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | Session token signing secret |
| `APP_URL` | Yes | Canonical origin (also used for CSRF origin checks) |
| `API_PORT` | Self-host | Port for the Express API (default `4000`) |
| `NEXT_PUBLIC_API_URL` | Self-host | Base URL the browser uses to reach the Express API |
| `EMAIL_API_KEY` | Optional | Enables transactional email |
| `CONTACT_NOTIFY_EMAIL` | Optional | Inbox that receives contact-form notifications |
| `EMAIL_FROM_ADDRESS` | Optional | `From:` address for outbound email |
| `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` | Production | S3-compatible object storage for admin uploads |
| `STORAGE_PUBLIC_URL` | Optional | Public base URL for stored objects (also authorises `next/image` + CSP) |
| `STORAGE_REGION`, `STORAGE_ENDPOINT`, `STORAGE_FORCE_PATH_STYLE`, `STORAGE_DRIVER` | Optional | Region / custom endpoint (R2, MinIO) / path-style flag / forced driver |
| `RAZORPAY_*` / `STRIPE_*` | Optional | Payment gateways |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Production | Cache, rate limiting, idempotency, pub/sub |
| `CAFE_*` | Optional | Override site identity, contact details and social links |

> **Secrets:** never commit `.env*` files (all are gitignored except `.env.example`), and never expose a secret through a `NEXT_PUBLIC_*` variable — those are inlined into the client bundle.

---

## Available Scripts

| Script | Description |
| :--- | :--- |
| `npm run dev` | Next.js dev server |
| `npm run dev:server` | Express API only |
| `npm run dev:all` | Both runtimes concurrently |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run start:server` | Run the Express API in production mode |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest (unit, integration, security) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:e2e` | Build + Playwright E2E |
| `npm run db:migrate` | Apply migrations (`prisma migrate deploy`) |
| `npm run db:seed` | Seed the database |
| `npm run db:studio` | Prisma Studio |
| `npm run create-admin` | Bootstrap an admin account |
| `npm run verify:prod` | Deployment preflight checks |

---

## API Surface

Route Handlers under `app/api/v1/*` are the production API. The Express service
(`server/api.ts`, port 4000) is the **self-host and local-development** runtime; it
implements a subset of this surface, and the two are being brought into line
(see [docs/plans/phase-1-completion.md](docs/plans/phase-1-completion.md)).

| Endpoint | Method | Auth | Runtime |
| :--- | :--- | :--- | :--- |
| `/api/health` | GET | Public | Both |
| `/api/v1/menu` | GET | S2S `menu:read` | Both |
| `/api/v1/orders` | GET / POST | S2S `orders:read` / `orders:write` | GET both · POST Next only |
| `/api/v1/orders/:id` | GET / PATCH | S2S | GET both · PATCH Next only |
| `/api/v1/reservations` | GET / POST | S2S `reservations:read` / `reservations:write` | Next |
| `/api/v1/loyalty/profile` | GET | Public (email query param) | Next |
| `/api/v1/waitlist/:id` | GET | Public | Next |
| `/api/v1/realtime/kds` | GET | S2S or admin session | Both (SSE) |
| `/api/v1/webhooks/payment` | POST | HMAC | Both |
| `/api/v1/webhooks/ingress` | POST | Signature header | Next |
| `/api/v1/coupons/validate` | POST | Public | Express only |
| `/api/v1/system/metrics` | GET | Public | Express only |
| `/api/auth/login`, `/api/auth/logout`, `/api/contact`, `/api/upload`, `/api/notifications` | POST / GET | Mixed (session, public, SSE) | Next |

S2S requests authenticate with `Authorization: Bearer sp_live_...` and require the appropriate scope (for example `orders:write`).

Order ingestion is safe to retry. Send an `Idempotency-Key` header and a repeated
request returns the original response instead of booking a second order; reusing
the same key for a different body returns `409`. Requests are limited to 60 per
rolling minute per API key, and the route refuses to serve in production unless a
shared Redis backend (`UPSTASH_*`) is configured, because per-instance memory
cannot deduplicate across instances.

---

## Testing & Quality

Quality gates run locally and in CI on every push and pull request:

```bash
npm run typecheck   # TypeScript, 0 errors
npm run lint        # ESLint, clean
npm test            # Vitest — 192 tests across 31 files
npm run test:e2e    # Playwright — desktop Chromium + mobile Chrome
```

**Measured status (as of this commit):**

| Gate | Result |
| :--- | :--- |
| `tsc --noEmit` | 0 errors |
| ESLint | 0 warnings, 0 errors |
| Vitest | **192 passing** across 31 files |
| `next build` | Succeeds — 40 routes |
| Security audit (CI) | Weekly `npm audit` job |

The suites are `tests/unit/*`, `tests/integration/*`, `tests/security/*` and `tests/e2e/*`. For the full test strategy — including the contract tests, load tests, accessibility checks and coverage gates planned in later phases — see [`docs/TESTING.md`](./docs/TESTING.md).

---

## Project Structure

```
app/                  Next.js App Router — routes, layouts, Server Actions, Route Handlers
  (public)/           Customer-facing pages
  admin/              Admin CMS, KDS, panel pages and Server Actions
  api/v1/             Primary production API (Route Handlers)
components/           UI — brand, marketing, menu, cart, admin, ui primitives
config/               Typed app config — site, seo, roles, navigation
lib/                  Domain and infrastructure
  services/           Domain logic (orders, catalog, reservations, loyalty, inventory…)
  db/                 Prisma client, tenant resolution, helpers
  auth/               Passwords, sessions, guards, S2S keys
  cache/ queue/ realtime/ rate-limit/ resilience/   Infrastructure
  payments/ email/ webhooks/    Integrations
prisma/               Schema, migrations, seed
server/               Express API for self-host
tests/                unit / integration / security / e2e
docs/                 Architecture, database, operations, testing, SEO and ADRs
```

A complete annotated tree and the layering rules are in [`FILE_STRUCTURE.md`](./FILE_STRUCTURE.md).

---

## Documentation

| Document | Contents |
| :--- | :--- |
| [`docs/README.md`](./docs/README.md) | Documentation index and reading paths |
| [`docs/MASTER_PLAN.md`](./docs/MASTER_PLAN.md) | Master plan — architecture, capacity, SLOs, risk register |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | System design, data flows, networking, scaling |
| [`docs/DATABASE.md`](./docs/DATABASE.md) | Data model, indexing strategy, migrations, DB handling |
| [`docs/OPERATIONS.md`](./docs/OPERATIONS.md) | Deployment, environment, runbooks, incident response |
| [`docs/TESTING.md`](./docs/TESTING.md) | Test strategy, coverage policy, load and a11y plans |
| [`docs/SEO-AND-PERFORMANCE.md`](./docs/SEO-AND-PERFORMANCE.md) | SEO and Core Web Vitals plan with budgets |
| [`docs/ROADMAP.md`](./docs/ROADMAP.md) | Ten delivery phases with acceptance criteria |
| [`docs/AUDIT.md`](./docs/AUDIT.md) | Evidence-based audit (P0–P3 findings with file references) |
| [`docs/adr/`](./docs/adr/README.md) | Architecture Decision Records |
| [`SECURITY.md`](./SECURITY.md) | Security policy and reporting |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Contribution workflow and standards |
| [`CHANGELOG.md`](./CHANGELOG.md) | Notable changes |

---

## Deployment

**Vercel (recommended).** Connect the repository, set the environment variables above, and deploy. The build command is `prisma migrate deploy && next build`, so migrations run before the new code goes live. Bootstrap the first super-admin with `npm run create-admin`, then verify with `npm run verify:prod`. Because Vercel cannot host a long-lived process, the Express worker and any scheduled jobs run on a separate always-on host.

**Self-hosted.** Run the Next.js app and the Express API behind a reverse proxy, with a managed or self-hosted PostgreSQL and Redis instance, and a process manager to supervise the API and worker.

Full, step-by-step procedures for both targets — plus backups, restores and incident runbooks — are in [`docs/OPERATIONS.md`](./docs/OPERATIONS.md).

---

## Roadmap

Delivery is sequenced so that **correctness and deployability come before optimisation**:

| Phase | Theme |
| :--- | :--- |
| 0 | Documentation & licensing ✅ |
| 1 | Deployability & correctness |
| 2 | Database integrity & indexing |
| 3 | Stateless runtime (Redis, durable outbox) |
| 4 | Security hardening |
| 5 | Testing depth (contract, load, a11y) |
| 6 | SEO & performance |
| 7 | Observability & operations |
| 8 | Structure & developer experience |
| 9 | Commercial readiness |

Each phase has objectives, a task checklist, verifiable acceptance criteria and a rollback plan in [`docs/ROADMAP.md`](./docs/ROADMAP.md).

---

## Current Limitations

This project is under active development. The following are known and tracked; they are listed here rather than hidden, because a README that overstates readiness is worse than no README.

| Area | Status |
| :--- | :--- |
| **In-process state** | Cache, rate limiting, realtime pub/sub and the job queue run in-process. On serverless or multi-instance deployments these diverge; moving them to Redis and a durable DB-backed outbox is Phase 3. |
| **Tenant isolation** | `tenantId` is nullable and resolution fails open to the default tenant. Hardening to `NOT NULL`, fail-closed resolution and RLS is Phase 2. |
| **Order pricing** | The order endpoint currently trusts client-supplied line prices. Moving pricing authority fully server-side is Phase 1. |
| **Transactional email** | The `EMAIL_DISPATCH` job handler only logs today; it does not yet call the notifier. Phase 1. |
| **Uploads** | ✅ Fixed — object storage is a driver abstraction (`lib/storage/`) with an S3-compatible backend; uploads return `503` when unconfigured rather than writing base64 into the database. |
| **Express API in production** | `vercel.json` deploys Next.js only; the port-4000 API exists for self-host and local dev. |
| **Performance** | Several bundled images are ~950 KB, which caps mobile Lighthouse performance. The image pipeline and CWV budgets are Phase 6. |

Findings with precise file-and-line evidence are in [`docs/AUDIT.md`](./docs/AUDIT.md).

---

## Security

- Passwords are hashed with **Argon2id**; session tokens are stored only as **SHA-256** hashes and issued in `HttpOnly`, `SameSite=Lax`, `Secure` cookies.
- S2S API keys are stored hashed and verified with scope and allowlist checks.
- Payment webhooks are verified with **HMAC-SHA256** signatures and are idempotent.
- All input is validated with **Zod** and all queries go through **Prisma** parameterisation.
- Security headers and a Content Security Policy are applied in `next.config.ts`.

To report a vulnerability, please follow [`SECURITY.md`](./SECURITY.md). Do not open a public issue for security problems.

---

## Contributing

Contributions that improve the project are welcome under the terms of the license. Please read [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the workflow, coding standards, commit conventions and the requirement that every change keeps the quality gates green.

---

## License

**Proprietary — source-available, personal use only.**

Copyright © 2026 **Himanshu**. All Rights Reserved.

This project is **not** open source. You may view, study, fork and modify it, and self-host it **strictly for private, non-commercial use**. **Any commercial use is prohibited** without a separate written license — including running it for a real café or restaurant, offering it as a hosted or managed service, using it in client or agency work, or bundling it into a paid product.

To obtain a commercial license, contact:

- **Email:** [himanshuyt21361@gmail.com](mailto:himanshuyt21361@gmail.com)
- **GitHub:** [@Himanshusingh204](https://github.com/Himanshusingh204)

The full terms are in [`LICENSE`](./LICENSE). The "Spice & Saffron" brand assets are expressly reserved and are not licensed for reuse.

---

<p align="center"><em>Built with care for great food and resilient software.</em></p>
<p align="center">© 2026 Himanshu. All Rights Reserved.</p>
