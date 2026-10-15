# Operations Runbook

**Project:** Spice & Saffron — Multi-tenant Indian café/restaurant commerce & operations platform
**Owner:** Himanshu ([@Himanshusingh204](https://github.com/Himanshusingh204)) · himanshuyt21361@gmail.com
**Document status:** Operational runbook — living document, reviewed after every incident
**Last updated:** 2026-10-15
**Audience:** On-call engineer, platform/SRE, and the owner acting as on-call.

> This runbook describes how to run, deploy, monitor, and recover the platform. Where
> something is a **target design** rather than something that exists in the repository, it is
> labelled **[PROPOSED]** and must not be treated as already implemented. Facts about the
> current system are sourced from the repository at `022ab0c` + the uncommitted Phase 2.2
> working tree; see [`./AUDIT.md`](./AUDIT.md) and [`./MASTER_PLAN.md`](./MASTER_PLAN.md).

---

## Table of contents

1. [System overview for on-call](#1-system-overview-for-on-call)
2. [Environments](#2-environments)
3. [Local development](#3-local-development)
4. [Production deployment — Target A: Vercel (recommended)](#4-production-deployment--target-a-vercel-recommended)
5. [Production deployment — Target B: self-hosted container/VM](#5-production-deployment--target-b-self-hosted-containervm)
6. [Production deployment — Target C: split services](#6-production-deployment--target-c-split-services)
7. [Environment variable reference](#7-environment-variable-reference)
8. [Database operations](#8-database-operations)
9. [Redis operations](#9-redis-operations)
10. [Payments operations](#10-payments-operations)
11. [Background jobs & cron](#11-background-jobs--cron)
12. [Monitoring, health checks and alerting](#12-monitoring-health-checks-and-alerting)
13. [Incident runbooks](#13-incident-runbooks)
14. [Rollback procedures](#14-rollback-procedures)
15. [Scaling operations](#15-scaling-operations)
16. [Routine maintenance calendar](#16-routine-maintenance-calendar)
17. [Troubleshooting FAQ](#17-troubleshooting-faq)
18. [Related documents](#18-related-documents)

---

## 1. System overview for on-call

Spice & Saffron is a multi-tenant café/restaurant platform with a customer-facing storefront
(menu, ordering, reservations, loyalty, waitlist) and an operations back office (kitchen
display, floor plan, inventory, dispatch, CMS). It ships as **one Next.js 16 codebase** with
an **optional standalone Express API** for self-hosting, long-running workers and local
development.

### 1.1 Services, ports and placement

| Service | Runtime | Default port | Where it runs | Owner decision |
| :--- | :--- | :--- | :--- | :--- |
| Storefront + Admin + primary API | Next.js 16.3.1 (App Router, Node runtime) | 3000 | Vercel (production) or a Node host | **Primary production API is Vercel Route Handlers under `app/api/v1/*`** |
| Standalone REST API / worker / SSE | Express 5 (`server/api.ts`, run with `tsx`) | 4000 (`API_PORT`) | Self-hosted VM/container; local dev | Retained for self-hosting, long-running workers, local dev — **not deployed by `vercel.json`** |
| Database | PostgreSQL 18 (CI pins `postgres:16-alpine`) | 5432 | Managed Postgres | System of record |
| Cache / rate limit / idempotency / pub-sub | Upstash Redis (REST) | 443 (HTTPS REST) | Upstash | **Redis is a hard production dependency** — in-memory fallbacks are dev/test only |
| Background jobs + scheduled work | DB-backed outbox + worker + Vercel Cron | — | Worker host + Vercel Cron | **[PROPOSED]** durable outbox to replace the current in-process queue |
| Object storage | S3-compatible (AWS S3 / Cloudflare R2 / MinIO / B2) | 443 | `STORAGE_*`; filesystem in dev | **Resolved** — `lib/storage/` driver; required in production |

### 1.2 API surfaces

| Surface | Path | Adapter | Notes |
| :--- | :--- | :--- | :--- |
| Liveness | `/api/health` | Next Route Handler | Returns `{ status: "healthy", timestamp }`. **Does not touch the DB.** |
| Liveness + DB check | `/health`, `/api/health` | Express | Runs `SELECT 1`; returns `503` when the DB is unreachable. |
| Menu | `GET /api/v1/menu` | Both | Cache-aside, 300 s TTL, `X-Cache-Lookup: HIT/MISS`. |
| Coupons | `POST /api/v1/coupons/validate` | Express | Server-side coupon validation. |
| Orders | `GET /api/v1/orders`, `GET /api/v1/orders/:id` | Both | S2S scoped (`orders:read`). |
| KDS stream | `GET /api/v1/realtime/kds` | Both | SSE. Express heartbeats every 25 s; Next heartbeats every 20 s (`X-Accel-Buffering: no`). |
| Payment webhook | `POST /api/v1/webhooks/payment` | Both | Razorpay HMAC-SHA256 (`X-Razorpay-Signature`), idempotent. |
| System metrics | `GET /api/v1/system/metrics` | Express only | Uptime, `process.memoryUsage()`, queue metrics. **Missing on the Vercel path.** |

### 1.3 Observability today (verify before assuming)

- **Logs:** structured JSON via `lib/logger.ts` (`timestamp`, `level`, `event`, plus typed
  fields). Written to stdout/stderr of the process that emitted them.
- **Slow queries:** `lib/db/prisma.ts` logs `db.slow_query` (model, operation, `durationMs`)
  for any Prisma operation taking **>150 ms**.
- **Metrics:** the only metrics endpoint is Express `GET /api/v1/system/metrics`. There is
  **no Prometheus/OTel exporter** in the repository.
- **Tracing:** none in the repository. **[PROPOSED]** OpenTelemetry across HTTP → service →
  Prisma spans.

### 1.4 Known production blockers

These are confirmed defects, not hypotheticals. Treat them as runbook warnings.

| # | Blocker | Operational impact | Reference |
| :-- | :--- | :--- | :--- |
| B1 | ~~`@vercel/blob` referenced but not installed~~ **Resolved 2026-10-15**: replaced by a storage abstraction (`lib/storage/`) with a vendor-neutral S3-compatible driver. The base64 `data:` fallback is deleted. | None. In production set `STORAGE_BUCKET` + `STORAGE_ACCESS_KEY` + `STORAGE_SECRET_KEY`; uploads then return `503` when unconfigured rather than corrupting the database. | `lib/storage/index.ts`, `app/api/upload/route.ts`, [§17.2](#172-uploads-return-503-in-production) |
| B2 | `GET /api/v1/system/metrics` exists **only on Express**. | No queue/memory metrics on the primary Vercel deployment. | `server/api.ts:306` |
| B3 | Queue, event bus, rate limiter and cache are **in-process** (`new Map()`, `EventEmitter`, `setInterval`). | Multi-instance/serverless behaviour diverges: KDS tickets are invisible across instances, jobs are lost on deploy, rate limits multiply by instance count, cache hit rate collapses. | `lib/queue/job-queue.ts`, `lib/realtime/bus.ts`, `lib/rate-limit/limiter.ts`, `lib/cache/cache-manager.ts` |
| B4 | `server/api.ts` is **not deployed by `vercel.json`** and is **untested** by the suite. | The documented port-4000 API is unreachable in production on Vercel. | `vercel.json`, [`./AUDIT.md`](./AUDIT.md) P2-9 |
| B5 | ~~Working tree contains uncommitted work~~ **Resolved 2026-10-15**: committed in `46998ea` (features) and `f233136` (docs). | None. Migration `20260905180000_add_stations_inventory_tables_loyalty` is tracked and applied by the deploy pipeline. | [`./ROADMAP.md`](./ROADMAP.md) §1.4 |

### 1.5 Who to contact / escalation

| Tier | Who | How | When |
| :--- | :--- | :--- | :--- |
| L1 (first responder) | Himanshu (owner/on-call) | himanshuyt21361@gmail.com | Every alert. Acknowledge within 15 min for P1. |
| Vendor — hosting | Vercel Support | Vercel dashboard → Support | Platform-level outage, deploy failures with a Vercel error code |
| Vendor — database | Managed Postgres provider support | Provider console | DB failover, storage exhaustion, replication lag |
| Vendor — cache | Upstash Support | Upstash console | Redis REST errors/outage |
| Vendor — payments | Razorpay / Stripe merchant dashboard | Gateway dashboard → Support | Webhook delivery failures at the gateway, settlement disputes |
| Security | GitHub Private Vulnerability Reporting on the repo, or `[SECURITY]` email | See [`../SECURITY.md`](../SECURITY.md) | Suspected breach, leaked secret, vulnerability report |

**Escalation rule:** there is a single on-call human. If an incident exceeds the RTO
([§8.6](#86-restore-procedure)) or a payment/data-integrity issue is confirmed, page the
owner directly by email and open a written incident record before attempting further
mitigations.

---

## 2. Environments

| Environment | Purpose | Runtime / port | Data | Access rules |
| :--- | :--- | :--- | :--- | :--- |
| **Local** | Feature development, manual QA | `npm run dev` (Next, 3000); optionally `npm run dev:server` (Express, 4000); `npm run dev:all` runs both | Developer's local PostgreSQL; `SEED_DEMO_DATA=true` allowed | No shared secrets; `.env.local` is git-ignored. Never point at production. |
| **Test (vitest)** | Unit, integration, security suites | Vitest (`npm test`), in-process | Tests use a test database derived from `DATABASE_URL` via `tests/setup/test-db-url.ts`; `tests/setup/global-setup.ts` prepares it | Run against a disposable DB only. Never against production. |
| **E2E (Playwright)** | Full-stack browser flows | `npx next start -p 3100` (`E2E_PORT`, default 3100) | Test DB; `SEED_DEMO_DATA=true`; `LOGIN_RATE_MAX=100`, `CONTACT_RATE_MAX=50` to avoid self-lockout | `APP_URL` **must** equal the served origin (`http://localhost:3100`) or CSRF origin checks reject mutations. Do not run against shared data. |
| **Staging** | **[PROPOSED — not provisioned]** Pre-production verification with production-like config | Mirror of production (Vercel preview or a dedicated VM) | Anonymised or synthetic data only; never a copy of live PII | Same env-var shape as production but distinct secrets and a distinct database. Recommended before every risky release. |
| **Production** | Live customers and staff | Vercel (Next) + separate worker host where needed | Real customer/order data | Least privilege. No `SEED_DEMO_DATA`. No direct DB shell except during a declared incident. |

Notes:
- There is **no staging configuration in the repository today**; the row above is a
  recommendation, labelled as such.
- Local and test are the only environments that may use the in-memory fallbacks for cache,
  rate limit, idempotency and pub/sub. Production **must** have Redis configured
  ([§9](#9-redis-operations)).
- The test/e2e database URL transformation lives in `tests/setup/test-db-url.ts`; do not
  hard-code a database name into test code.

---

## 3. Local development

### 3.1 Prerequisites

| Requirement | Version | Evidence |
| :--- | :--- | :--- |
| Node.js | **>= 20.19**; CI uses **22**; `.nvmrc` pins **22** | `.nvmrc` = `22`; `.github/workflows/ci.yml` `node-version: 22` |
| npm | **>= 10** | ships with Node 20/22 |
| PostgreSQL | **>= 14** (CI pins `postgres:16-alpine`; production target is 18) | `ci.yml`; stack target |
| Playwright browsers | installed on demand (`npx playwright install chromium`) — for E2E only | `ci.yml` |

### 3.2 Bootstrap

1. Clone and enter the repository.
2. Install dependencies. `postinstall` runs `prisma generate` automatically:
   ```bash
   npm install
   ```
3. Create the local env file and fill it:
   ```bash
   cp .env.example .env.local
   ```
4. Generate a session secret and paste it into `AUTH_SECRET`:
   ```bash
   openssl rand -base64 32
   ```
5. Set `DATABASE_URL` (e.g.
   `postgresql://USER:PASSWORD@localhost:5432/indian_cafe?schema=public`) and `APP_URL`
   (`http://localhost:3000`).
6. Apply migrations and seed:
   ```bash
   npm run db:migrate      # prisma migrate deploy
   npm run db:seed         # prisma db seed (tsx prisma/seed.ts)
   ```
   Set `SEED_DEMO_DATA="true"` in `.env.local` before seeding to include demo dishes,
   categories and gallery images. Default is `false`.
7. Create an admin:
   ```bash
   ADMIN_EMAIL="admin@spiceandsaffron.in" ADMIN_PASSWORD="YourSecurePassword123!" npm run create-admin
   ```
   `ADMIN_PASSWORD` must be **at least 10 characters**. Optional `ADMIN_NAME` (default
   `Café Owner`) and `ADMIN_ROLE` (default `SUPER_ADMIN`). If the email already exists, the
   script resets its password and reactivates it.

### 3.3 Run modes

| Mode | Command | What runs | When |
| :--- | :--- | :--- | :--- |
| Frontend only | `npm run dev` | Next.js dev server (3000) | Most UI work; `app/api/v1/*` Route Handlers serve the API |
| Backend only | `npm run dev:server` | Express (`tsx server/api.ts`) on 4000 | Working on the standalone API, SSE, webhook ingress |
| Both | `npm run dev:all` | `concurrently` runs `dev` + `dev:server` | Full local topology; storefront at 3000, API at 4000 |
| Production-like (local) | `npm run build && npm start` | `next build` then `next start` | Verifying a build locally |
| Database studio | `npm run db:studio` | Prisma Studio | Ad-hoc data inspection (local only) |

> **Two-runtime caveat:** in `dev:all`, the Next.js process and the Express process each hold
> their own in-process event bus, queue and cache. A KDS ticket created through Next.js is
> **not** visible to an SSE client connected to Express, and vice versa
> ([`./MASTER_PLAN.md`](./MASTER_PLAN.md) §2.2). This is a known defect (B3), not a
> misconfiguration.

### 3.4 Quality gate (run before every commit)

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest run
npm run build       # next build
```

E2E (requires the local DB to be migrated and seeded first):

```bash
npm run test:e2e    # next build && playwright test
```

See [`./TESTING.md`](./TESTING.md) for the full strategy.

---

## 4. Production deployment — Target A: Vercel (recommended)

`vercel.json` sets `framework: nextjs`, `installCommand: npm install`, and
`buildCommand: node scripts/vercel-build.mjs`. **This deploys the Next.js application only.**
There is no port 4000 in production — the Express API/worker/SSE must be hosted elsewhere
(Target B/C) if you need it, and note that **no container packaging for it exists in the
repository yet** (there is no `Dockerfile`); the Target B/C steps in [§6](#6-self-hosted-deployment--target-bc)
are a design, not a shipped artefact.

### 4.1 Deploy steps

1. **Create the database.** Provision a managed PostgreSQL 18 instance. Note the connection
   string; it must use TLS (`sslmode=require`) and a least-privilege role
   ([`../SECURITY.md`](../SECURITY.md) hardening checklist).
2. **Create the Redis instance.** Provision Upstash Redis and capture
   `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` ([§9](#9-redis-operations)).
3. **Connect the repository** to a new Vercel project. Framework preset: Next.js. Leave the
   build command to `vercel.json`.
4. **Set environment variables** in Vercel → Project → Settings → Environment Variables
   (Production; mirror to Preview as appropriate). Use the full table in
   [§7](#7-environment-variable-reference). Minimum required for a functional deploy:
   `DATABASE_URL`, `AUTH_SECRET`, `APP_URL`, `UPSTASH_REDIS_REST_URL`,
   `UPSTASH_REDIS_REST_TOKEN`. Add payment and email variables to enable those flows.
   > **Warning:** nothing sensitive may be exposed as `NEXT_PUBLIC_*`. Public variables are
   > inlined into the browser bundle. Only `NEXT_PUBLIC_API_URL` (a URL, not a secret) is
   > public by design.
5. **Verify the build behaviour.** `node scripts/vercel-build.mjs` applies migrations **only for
   production builds**: `VERCEL_ENV=preview` (and `development`) skips `prisma migrate deploy`
   and goes straight to `next build`. This exists so a branch deploy can never migrate the
   production database. Two consequences to plan for:
   - Ensure `DATABASE_URL` is available at **build time** in the Production environment, not
     only at runtime.
   - **Give preview deployments their own database.** The guard stops the repository from
     migrating production on a preview build; it cannot stop two environments from being
     pointed at the same `DATABASE_URL`. Verify this in Vercel → Settings → Environment
     Variables before the first preview deploy.
6. **First deploy.** Push to the production branch (or deploy manually). The build log prints
   the plan up front (`prisma migrate deploy : RUN|skip`, `next build : RUN`), so the migration
   decision is auditable after the fact.
7. **Preflight the deployment** from a machine that can reach the URL:
   ```bash
   APP_URL="https://your-domain.com" npm run verify:prod
   # or: node scripts/verify-deployment.mjs https://your-domain.com
   ```
   This checks `/api/health`, security headers, `robots.txt`, `sitemap.xml`, the public routes
   (`/`, `/menu`, `/about`, `/gallery`, `/reservations`, `/contact`, `/faq`, `/privacy`,
   `/terms`), the `/admin` → `/admin/login` redirect, and the **API surface** — that
   `/api/v1/menu` and `/api/v1/orders` answer `401` (not `404`) without credentials, which is
   the difference between a deployed Route Handler and a missing one. It exits non-zero on
   failure.
8. **Bootstrap the super admin** against the production database:
   ```bash
   ADMIN_EMAIL="owner@your-domain" \
   ADMIN_PASSWORD="<strong, unique, >=10 chars>" \
   ADMIN_NAME="Himanshu" \
   ADMIN_ROLE="SUPER_ADMIN" \
   npm run create-admin
   ```
   `scripts/create-admin.mjs` reads `DATABASE_URL` from the environment, so run it with the
   production `DATABASE_URL` (or a temporary shell in a network that is allow-listed by the
   database firewall). It is idempotent: if the email exists it resets the password and
   reactivates the account. **Never** seed demo data in production.
9. **Register the payment webhook** in the gateway dashboard
   ([§10.3](#103-webhook-endpoint-url)).
10. **Confirm Redis is actually used.** Hit a cached route twice and confirm the Express
    metrics/`X-Cache-Lookup` behaviour where applicable. Redis is a hard dependency by owner
    decision; a silent in-memory fallback in production is a defect, not a degradation path.

### 4.2 What Vercel does NOT run

| Not deployed on Vercel | Consequence | Where it must live |
| :--- | :--- | :--- |
| `server/api.ts` (Express, port 4000) | Express-only routes (`/api/v1/coupons/validate`, `/api/v1/system/metrics`, the Express SSE endpoint) are absent | Target B/C worker host |
| Long-running worker / `setInterval` loop | Serverless instances are frozen between requests; the current `JobQueue` would never drain reliably | Target B/C worker host + Vercel Cron **[PROPOSED]** |
| Persistent filesystem | Local upload writes fail on the read-only serverless filesystem. **Resolved**: there is no base64 fallback — production uses an object store (B1). | Configure `STORAGE_*`; uploads return `503` when unconfigured |

### 4.3 Post-deploy checklist (Target A)

- [ ] `npm run verify:prod` passes.
- [ ] `/api/health` returns `status: "healthy"`.
- [ ] Security headers present (CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options`,
      `Referrer-Policy`) — `next.config.ts` sets them; `verify-deployment.mjs` asserts them.
- [ ] `/admin` redirects to `/admin/login`; the super admin can log in (cookie `cafe_session`).
- [ ] A test order can be created and appears in the KDS.
- [ ] A Razorpay test webhook is accepted (HTTP 200) and an invalid signature is rejected (400).
- [ ] Redis keys appear in Upstash after exercising cached routes.

---

## 5. Production deployment — Target B: self-hosted container/VM

Choose Target B when you need the Express API, a long-lived worker, or SSE on infrastructure
you control. You run: the **Next app**, the **Express API/worker**, a **PostgreSQL** server (or
managed instance), **Redis**, and a **reverse proxy** in front of both Node processes.

> **No Dockerfile or `docker-compose.yml` currently exists in the repository.** The sketches
> below are **[PROPOSED]** design references, provided so an operator can create them. They
> have not been built or tested here.

### 5.1 Topology

```
Internet ──▶ Reverse proxy (Nginx/Caddy, TLS) ──▶ Next.js (3000)      ──▶ PostgreSQL
                                              └─▶ Express API (4000)  ──▶ PostgreSQL
                                                                        ──▶ Redis (Upstash or self-hosted)
```

### 5.2 Process management and health

- Run each Node process under a **process manager** (systemd unit, PM2, or the container
  orchestrator) with `restart: always`.
- **Liveness** (restart on failure): Express `/health` (checks `SELECT 1`); for Next, use
  `/api/health` (does **not** check the DB — see [§12](#12-monitoring-health-checks-and-alerting)).
- **Readiness** (remove from the load balancer without killing the process): must verify
  **DB and Redis**, and report `degraded` rather than `dead` when only Redis is down.
  **[PROPOSED]** — a readiness route does not exist yet.
- Graceful shutdown: the Express server traps `SIGTERM` and closes the listener
  (`server/api.ts:326`). Allow a drain window before `SIGKILL`.

### 5.3 Dockerfile sketch **[PROPOSED — not in the repo]**

```dockerfile
# PROPOSED: multi-stage build. Not yet present in the repository.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 3000 4000
# Next app:    npm start           (next start)
# Express API: npm run start:server (tsx server/api.ts)
CMD ["npm", "start"]
```

### 5.4 docker-compose sketch **[PROPOSED — not in the repo]**

```yaml
# PROPOSED: local/staging compose topology. Not yet present in the repository.
services:
  postgres:
    image: postgres:18-alpine
    environment:
      POSTGRES_DB: indian_cafe
      POSTGRES_USER: cafe
      POSTGRES_PASSWORD: change-me
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cafe"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    command: ["redis-server", "--appendonly", "yes"]
    volumes: [redisdata:/data]

  web:
    build: .
    command: npm start
    environment:
      DATABASE_URL: postgresql://cafe:change-me@postgres:5432/indian_cafe?schema=public
      AUTH_SECRET: ${AUTH_SECRET}
      APP_URL: ${APP_URL}
      UPSTASH_REDIS_REST_URL: ${UPSTASH_REDIS_REST_URL}
      UPSTASH_REDIS_REST_TOKEN: ${UPSTASH_REDIS_REST_TOKEN}
    depends_on:
      postgres: { condition: service_healthy }
    ports: ["3000:3000"]

  api:
    build: .
    command: npm run start:server
    environment:
      DATABASE_URL: postgresql://cafe:change-me@postgres:5432/indian_cafe?schema=public
      AUTH_SECRET: ${AUTH_SECRET}
      APP_URL: ${APP_URL}
      API_PORT: "4000"
    depends_on:
      postgres: { condition: service_healthy }
    ports: ["4000:4000"]

  proxy:
    image: caddy:2-alpine
    ports: ["80:80", "443:443"]
    volumes: ["./Caddyfile:/etc/caddy/Caddyfile:ro", "caddydata:/data"]

volumes:
  pgdata: {}
  redisdata: {}
  caddydata: {}
```

### 5.5 Target B checklist

- [ ] Reverse proxy terminates TLS and forwards to 3000 (Next) and 4000 (Express).
- [ ] `restart: always` (or systemd `Restart=always`) on every Node process.
- [ ] Postgres is a managed instance or a backed-up self-hosted server
      ([§8.5](#85-backups)).
- [ ] Redis is reachable from both processes and the app refuses to start without it in
      production **[PROPOSED boot-time assertion]**.
- [ ] Only 443 (and 80 for ACME) is exposed publicly; 3000/4000/5432 are internal.

---

## 6. Production deployment — Target C: split services

Vercel-hosted Next.js as the primary API, plus an **always-on Express worker host** for the
things Vercel cannot do.

```
Vercel (Next.js 3000-equivalent)
   ├─ app/api/v1/* primary API
   ├─ Vercel Cron → outbox drain endpoint   [PROPOSED]
   └─ payment webhook ingress
                     │  (shared DB + Redis)
Always-on host (Express, 4000)
   ├─ SSE /api/v1/realtime/kds
   ├─ background worker (outbox drainer)    [PROPOSED]
   └─ Express-only endpoints (coupons, metrics)
```

### 6.1 When to choose Target C

Choose Target C when **all** of the following hold:

- You want the operational simplicity and CDN/ISR benefits of Vercel for the storefront and
  the primary API.
- You need a long-lived process for the worker, durable retries, or SSE connections that
  outlive a serverless invocation.
- You can run one small always-on host (even a 1 vCPU VM) for the worker.

Do **not** choose Target C if you cannot give the worker host a stable outbound identity for
webhook egress, or if you cannot share the same Postgres and Redis between Vercel and the
worker. Do **not** run two independent copies of in-memory state (B3): the worker host and
Vercel must share Redis for pub/sub and the database for the outbox.

---

## 7. Environment variable reference

Scope: **server-only** variables must never be prefixed `NEXT_PUBLIC_`. The only public
variable is `NEXT_PUBLIC_API_URL` (a URL). Rotation cadence is a recommended maximum age; rotate
immediately on any suspected exposure.

| Variable | Required? | Scope | Purpose | Example / format | Rotation | Security note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `DATABASE_URL` | **Required** | Server-only | Prisma + Express DB connection | `postgresql://user:pass@host:5432/indian_cafe?schema=public` | On credential change / 12 mo | Use TLS (`sslmode=require`) + least-privilege role. Never log it. |
| `AUTH_SECRET` | **Required** | Server-only | Signs/encrypts sessions | `openssl rand -base64 32` | **90 days** (and on staff turnover) | Rotating invalidates active sessions. Unique per environment. |
| `APP_URL` | **Required** | Server-only | Canonical URL; CORS/CSRF origin; webhook base | `https://your-domain.com` | N/A | Must exactly match the served origin or CSRF checks fail. |
| `API_PORT` | Optional | Server-only | Express listen port | `4000` | N/A | Default 4000. Not used by Vercel deploys. |
| `NEXT_PUBLIC_API_URL` | Optional | **Public** | Browser-facing API base for the standalone API | `http://localhost:4000` | N/A | **Only** public variable. Must never hold a secret. |
| `UPSTASH_REDIS_REST_URL` | **Required in prod** | Server-only | Redis REST endpoint (cache/rate-limit/idempotency/pub-sub) | `https://xxx.upstash.io` | On project change | Without it the app falls back to memory; order ingestion returns `503` in production rather than risk duplicate orders. |
| `UPSTASH_REDIS_REST_TOKEN` | **Required in prod** | Server-only | Redis REST auth token | opaque string | **90 days** | Full data access to the cache; treat as credential. |
| `EMAIL_API_KEY` | Optional | Server-only | Resend API key for contact/reservation/receipt email | `re_...` | **90 days** | **See discrepancy below.** |
| `CONTACT_NOTIFY_EMAIL` | Optional | Server-only | Recipient for contact-form notifications | `owner@domain` | N/A | Required together with `EMAIL_API_KEY` for contact email to send. |
| `EMAIL_FROM_ADDRESS` | Optional | Server-only | Verified sender | `Spice & Saffron <no-reply@domain>` | N/A | Defaults to the Resend onboarding sender until a domain is verified. |
| `STORAGE_DRIVER` | Optional | Server-only | Force a driver: `s3` or `local` | `s3` | N/A | Left blank, S3 is used when a bucket is set; otherwise `local` outside production. |
| `STORAGE_BUCKET` | **Required in prod** | Server-only | Object storage bucket name | `cafe-uploads` | N/A | With the two keys below, activates the S3-compatible driver. |
| `STORAGE_REGION` | Optional | Server-only | Bucket region | `ap-south-1`, or `auto` for R2 | N/A | Defaults to `auto`. |
| `STORAGE_ENDPOINT` | Optional | Server-only | Custom S3 endpoint | `https://<acct>.r2.cloudflarestorage.com` | N/A | Omit for AWS S3. Set for R2/MinIO/B2. |
| `STORAGE_ACCESS_KEY` | **Required in prod** | Server-only | Object storage access key | opaque | **90 days** | Least-privilege bucket policy. |
| `STORAGE_SECRET_KEY` | **Required in prod** | Server-only | Object storage secret | opaque | **90 days** | Rotate with the access key. |
| `STORAGE_PUBLIC_URL` | **Recommended in prod** | Server-only | Public base URL objects are served from | `https://cdn.domain` | N/A | Read at build time to authorise `next/image` and the CSP `img-src`. |
| `STORAGE_FORCE_PATH_STYLE` | Optional | Server-only | `true` for MinIO | `true` | N/A | Left blank for AWS S3 and R2. |
| `RAZORPAY_KEY_ID` | Optional | Server-only | Razorpay key id | `rzp_live_...` / `rzp_test_...` | On gateway rotation | Live vs test inferred from prefix. Never expose client-side without a server-confirmed order. |
| `RAZORPAY_KEY_SECRET` | Optional | Server-only | Razorpay API + client signature secret | opaque | **180 days** | Also used as a webhook-secret fallback. Highest-sensitivity payment credential. |
| `RAZORPAY_WEBHOOK_SECRET` | Optional | Server-only | HMAC secret for webhook signatures | opaque | **180 days** | If unset, verification falls back to `RAZORPAY_KEY_SECRET`. Rotate in lockstep with the dashboard. |
| `STRIPE_SECRET_KEY` | Optional | Server-only | Stripe API secret | `sk_live_...` / `sk_test_...` | **180 days** | Live vs test inferred from prefix. |
| `STRIPE_WEBHOOK_SECRET` | Optional | Server-only | Stripe webhook signing secret | `whsec_...` | **180 days** | **No Stripe webhook route exists today** (only Razorpay ingress). Do not register a Stripe endpoint until one is implemented. |
| `ADMIN_EMAIL` | Bootstrap-only | Server-only | Admin email for `create-admin` | `owner@domain` | N/A | Used only by `scripts/create-admin.mjs`. Never commit. |
| `ADMIN_PASSWORD` | Bootstrap-only | Server-only | Admin password (≥10 chars) | strong passphrase | N/A | Pass via the shell environment, not a file. |
| `ADMIN_NAME` | Bootstrap-only | Server-only | Display name | `Himanshu` | N/A | Default `Café Owner`. |
| `ADMIN_ROLE` | Bootstrap-only | Server-only | Role | `SUPER_ADMIN` | N/A | Default `SUPER_ADMIN`. Grant the least privilege needed. |
| `SEED_DEMO_DATA` | Local/test only | Server-only | Seeds demo dishes/categories/gallery | `true` / `false` | N/A | **Never `true` in production.** |
| `CAFE_NAME` | Optional | Server-only | Seed override: brand name | `Spice & Saffron` | N/A | Seed-time only. |
| `CAFE_TAGLINE` | Optional | Server-only | Seed override: tagline | string | N/A | Seed-time only. |
| `CAFE_PHONE` | Optional | Server-only | Seed override: phone | `+91 ...` | N/A | Seed-time only. |
| `CAFE_EMAIL` | Optional | Server-only | Seed override: email | `hello@domain` | N/A | Seed-time only. |
| `CAFE_ADDRESS` | Optional | Server-only | Seed override: address | string | N/A | Seed-time only. |
| `CAFE_MAPS_LINK` | Optional | Server-only | Seed override: maps URL | URL | N/A | Seed-time only. |
| `CAFE_OPENING_HOURS` | Optional | Server-only | Seed override: hours | string | N/A | Seed-time only. |
| `CAFE_INSTAGRAM` | Optional | Server-only | Seed override: Instagram | URL | N/A | Seed-time only. |
| `CAFE_FACEBOOK` | Optional | Server-only | Seed override: Facebook | URL | N/A | Seed-time only. |
| `CAFE_WHATSAPP` | Optional | Server-only | Seed override: WhatsApp | `+91 ...` | N/A | Seed-time only. |
| `CAFE_RESERVATION_LINK` | Optional | Server-only | Seed override: reservation link | URL | N/A | Seed-time only. |

### 7.1 Documentation discrepancy: `EMAIL_API_KEY` vs `RESEND_API_KEY`

**The real environment variable is `EMAIL_API_KEY`.** `README.md:255` documents
`RESEND_API_KEY=""` in its example `.env` block, but no code reads `RESEND_API_KEY`.
`lib/email/notifier.ts` reads `EMAIL_API_KEY` (and `CONTACT_NOTIFY_EMAIL`,
`EMAIL_FROM_ADDRESS`). Setting `RESEND_API_KEY` therefore silently disables contact,
reservation and receipt email. **Operational rule:** always provision `EMAIL_API_KEY`; treat
`RESEND_API_KEY` in the README as a documentation bug
([`./AUDIT.md`](./AUDIT.md) P3-3). The README wins on nothing here — `.env.example` is the
source of truth.

### 7.2 Least-privilege roles

- **Database:** the app role needs DML on the schema and the ability to read/write outbox
  tables; migrations should run under a separate role with DDL rights used only by the deploy
  step.
- **Redis:** a single Upstash token currently covers all keys. **[PROPOSED]** separate tokens
  or key prefixes per concern if the provider supports scoping.
- **Object storage:** bucket policy limited to the upload prefix; no `Delete` unless required.

---

## 8. Database operations

### 8.1 Applying migrations

Production and CI apply migrations with:

```bash
npm run db:migrate          # prisma migrate deploy
```

`node scripts/vercel-build.mjs` runs `prisma migrate deploy` for a production Vercel build and
skips it for preview/development builds, then runs `next build`. **Never** run
`prisma migrate dev` against production: it is interactive and can reset data. `migrate deploy`
is forward-only and idempotent over already-applied migrations.

Current migration history (in `prisma/migrations/`):

```
20260820204724_init
20260903170133_add_reservations_orders_reviews
20260903194516_add_b2b_saas_s2s_webhooks
20260904204242_add_payment_gateway_fields
20260905092012_add_modifiers_dining_mode_tips
20260905180000_add_stations_inventory_tables_loyalty   ← present in the tree, confirmed unapplied in the audit
```

### 8.2 Seeding safely

```bash
npm run db:seed             # prisma db seed → tsx prisma/seed.ts
```

- `SEED_DEMO_DATA="false"` (default) seeds baseline settings/catalog only.
- `SEED_DEMO_DATA="true"` also seeds demo dishes, categories and gallery images.
- **Never run demo seeding in production.** The seed is idempotent for baseline settings, but
  demo data in a live tenant is a data-quality incident.
- Reconcile the uncommitted Phase 2.2 work and the unapplied migration **before** relying on
  the seed to produce a consistent schema (B5).

### 8.3 Schema-change policy

1. **Expand → migrate → contract.** Add nullable columns/tables first; backfill; deploy code
   that reads both shapes; only then add `NOT NULL`/drop columns.
2. **Never edit an applied migration.** An applied migration is immutable — editing it makes
   the checksum in `_prisma_migrations` disagree with the file and `migrate deploy` will fail
   or, worse, silently diverge between environments. Create a new migration instead.
3. **Index creation on large tables** should use `CREATE INDEX CONCURRENTLY` (requires a
   migration with `-- prisma migrate` care, since Prisma wraps some statements in
   transactions). Validate the plan with `EXPLAIN (ANALYZE, BUFFERS)`.
4. **Back up before destructive DDL.** A drop/alter on a live table without a fresh backup and
   a rollback plan is a P1-by-default change.
5. **Review every new index against a named query.** An unused index is a write tax
   ([`./DATABASE.md`](./DATABASE.md)).

### 8.4 Connection handling

`lib/db/prisma.ts` creates `new PrismaPg({ connectionString })` with **no pool bounds**
(there is no `max`, `idleTimeoutMillis`, or `statement_timeout`). Under serverless concurrency
this can exhaust Postgres `max_connections` ([`./AUDIT.md`](./AUDIT.md) P1-2). Until bounded
pools are added, run Postgres behind a pooler in transaction mode and follow
[§15.3](#153-pool-sizing-rules).

### 8.5 Backups

- **Daily full backup** plus **continuous WAL archiving** for point-in-time recovery (PITR),
  configured on the managed Postgres provider.
- **RPO ≤ 5 minutes**, **RTO ≤ 1 hour** ([§12.2](#122-slo-table)).
- **Retention:** at least 7 daily, 4 weekly, and 12 monthly restore points (or the provider's
  equivalent).
- **Redis is a cache**, never a system of record. Nothing critical may exist only in Redis
  ([`./MASTER_PLAN.md`](./MASTER_PLAN.md) §10.3).
- Encrypt backups at rest and verify that restore credentials are stored separately from the
  primary database credentials.

### 8.6 Restore procedure

1. **Declare the restore.** Record the incident, the intended recovery target (timestamp or
   backup id), and the RPO/RTO clock start.
2. **Freeze writes.** Put the application in maintenance mode / scale the web tier to zero so
   no writes land during restore. Existing sessions may remain open read-only.
3. **Provision a fresh instance** (or a new database on the same cluster). Do **not** restore
   over the live database first — you lose the ability to compare or fall back.
4. **Restore the chosen base backup** (`pg_restore` for a dump, or the provider's restore UI).
5. **Replay WAL** to the target point in time using the provider's PITR mechanism.
6. **Validate the schema** is at the expected migration:
   ```bash
   npx prisma migrate status
   ```
   If the backup predates a migration, apply migrations with `npm run db:migrate`.
7. **Verify row counts** on the critical tables (`Order`, `Admin`, `Tenant`, `Category`,
   `Dish`) against the last known-good counts recorded in monitoring.
8. **Run the smoke suite** against a read-only deployment pointed at the restored database:
   ```bash
   APP_URL="https://restore-verify.example" npm run verify:prod
   ```
9. **Cut over.** Repoint the application's `DATABASE_URL` (update Vercel env vars / the
   process manager) and redeploy or restart. Unfreeze writes.
10. **Confirm and close.** Watch 5xx rate, payment webhooks, and queue lag for 30 minutes.
    Record the actual RPO/RTO achieved and any data loss window.

### 8.7 Quarterly restore drill

A backup that has never been restored is not a backup.

- [ ] Pick the most recent production backup (not a scratch dump).
- [ ] Restore it to a **separate** scratch database using [§8.6](#86-restore-procedure)
      steps 3–8 — without touching production.
- [ ] Run `npx prisma migrate status`; confirm the schema matches `main`.
- [ ] Run `npm run verify:prod` against a temporary deployment pointed at the scratch DB.
- [ ] Spot-check 10 recent orders, their line items, and payment statuses.
- [ ] Measure and record **actual RPO** (data age at restore point) and **actual RTO** (time
      to a serving system). Both must meet ≤5 min / ≤1 h.
- [ ] Confirm the restore record is stored with the drill date, backup id, and any anomalies.
- [ ] Delete the scratch database afterwards (including snapshots).

---

## 9. Redis operations

### 9.1 Why Redis is required

By owner decision, Redis (Upstash REST today) is a **hard production dependency** that backs
four concerns, all of which currently have silent in-memory fallbacks:

| Concern | Module | Key pattern | TTL |
| :--- | :--- | :--- | :--- |
| **Cache** (cache-aside) | `lib/cache/cache-manager.ts` | `cafe:<key>` (e.g. `cafe:api:menu:all`) | 300 s default; menu 300 s |
| **Rate limit** (sliding window) | `lib/rate-limit/limiter.ts` | `rl:<key>` | Window length |
| **Idempotency** (request dedupe) | `lib/resilience/idempotency.ts` | `idempotency:<key>` | 86 400 s (24 h) default |
| **Pub/sub** (KDS fan-out) **[PROPOSED]** | `lib/realtime/bus.ts` (currently `EventEmitter`) | `tenant:<tenantId>` | N/A (pub/sub) |

### 9.2 Key naming and TTL conventions

- Prefix every key with its concern (`cafe:`, `rl:`, `idempotency:`). Do not invent bare
  keys.
- Every cache key **must** have a TTL. A key with no TTL is a leak.
- Include the tenant in keys for tenant-scoped data so invalidation can be prefix-scoped.
- Prefer versioned prefixes over `KEYS` scans. `lib/cache/cache-manager.ts:138` currently
  uses `KEYS <prefix>*` for `deleteByPrefix`, which is O(N) and blocks Redis
  ([`./AUDIT.md`](./AUDIT.md) P1-3). Until it is replaced with `SCAN`/versioned prefixes,
  keep prefix invalidations rare and off the hot path.
- Cap in-memory fallbacks (`MAX_MEM_CACHE_ENTRIES = 5000`, rate-limit `10_000`,
  idempotency `5000`) — these bounds apply only to dev/test.

### 9.3 Degraded-mode expectations

When Redis is unavailable, production must degrade in this order of preference — and must
**never fail an order because the cache is down**:

1. **Bypass the cache** — read through to Postgres. Correct, slower.
2. **Fall back to a local (per-instance) rate limit** — weaker but present.
3. **Fall back to local idempotency** — best-effort; a retry across instances may duplicate.
4. **Log loudly** at `warn`/`error` with the failing key and operation; a silent fallback is
   forbidden by the audit ([`./AUDIT.md`](./AUDIT.md) P0-2).
5. **Never block or fail a checkout, payment capture, or order mutation** on Redis.

**[PROPOSED]:** a boot-time assertion that refuses to start in `NODE_ENV=production` when
`UPSTASH_REDIS_REST_URL`/`_TOKEN` are missing, so production cannot silently run on memory.

### 9.4 Redis incident checklist

- [ ] Confirm scope: is Redis down, or is it only the app's token/URL?
- [ ] Check the Upstash dashboard for an outage or quota exhaustion.
- [ ] Confirm the app is degrading (orders still succeed) and logging loudly
      ([§13.8](#138-redis-outage)).
- [ ] If the token was rotated incorrectly, restore the prior token or push the correct env and
      redeploy.
- [ ] After recovery, warm critical caches (menu) and confirm `X-Cache-Lookup: HIT`.

---

## 10. Payments operations

Gateways: **Razorpay** (UPI/cards/netbanking, India) and **Stripe** (global cards). The
implemented webhook ingress is **Razorpay only** (`app/api/v1/webhooks/payment/route.ts` and
`server/api.ts`). A Stripe webhook route does not exist.

### 10.1 Key handling

- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` and `STRIPE_SECRET_KEY` are **server-only**.
  Never expose them via `NEXT_PUBLIC_*`.
- Live vs test is inferred from the key prefix (`rzp_live_` vs `rzp_test_`, `sk_live_` vs
  `sk_test_`). A test key in production disables real capture; a live key in staging can move
  real money. Verify prefixes after every rotation.
- Client signature verification uses `RAZORPAY_KEY_SECRET` (HMAC-SHA256 over
  `orderId|paymentId`), constant-time (`lib/payments/engine.ts`).
- Webhook verification uses `RAZORPAY_WEBHOOK_SECRET`, **falling back to**
  `RAZORPAY_KEY_SECRET` when the webhook secret is unset. Set both to avoid an accidental
  dependency on the API secret.

### 10.2 Webhook secret rotation

1. In the gateway dashboard, note the current webhook secret.
2. Generate/accept a new secret in the dashboard and **keep the old one valid** if the
   dashboard supports multiple secrets; otherwise schedule a brief maintenance window.
3. Update `RAZORPAY_WEBHOOK_SECRET` in Vercel/worker env and redeploy/restart.
4. Send a test webhook. Confirm HTTP 200 and that an invalid signature still returns 400
   ([§13.5](#135-payment-webhooks-failing)).
5. Remove the old secret from the dashboard once deliveries are confirmed on the new secret.
6. Record the rotation date; the target cadence is **every 180 days**.

### 10.3 Webhook endpoint URL

Register this URL in the Razorpay dashboard (Webhooks):

| Deployment | URL to register |
| :--- | :--- |
| **Target A (Vercel, recommended)** | `https://<your-domain>/api/v1/webhooks/payment` |
| **Target B/C (Express)** | `https://<api-host>/api/v1/webhooks/payment` (port 4000 behind the proxy) |

Subscribe to at least `payment.captured` and `order.paid`. The handler treats both as a
successful payment.

### 10.4 Idempotent replay

- The handler looks up the order by `notes.appOrderId` or `gatewayOrderId`, then **short-circuits
  if `paymentStatus === "PAID"`**, returning `200` with no state change. A duplicate delivery
  is therefore safe.
- Missing identifiers return `200` with a note (not an error) so the gateway does not retry
  forever.
- **[PROPOSED]:** a durable `webhook_event` table (event id + payload) so replays are
  deduplicated even across handler versions, alongside the current order-state check.

### 10.5 Reconciliation

1. Export the gateway's settled/captured report for the window.
2. Compare against `Order` rows where `paymentStatus = 'PAID'` and `createdAt` is in the
   window.
3. Investigate: (a) gateway `PAID`, app not `PAID` → webhook not delivered or failed
   ([§10.6](#106-incident-paid-but-order-still-pending)); (b) app `PAID`, gateway not settled →
   possible capture/settlement lag or a forged-state bug.
4. For every mismatch, open a ticket with the gateway before changing app state.
5. Reporting/analysis reads should go to a **read replica** once one exists
   ([§15](#15-scaling-operations)).

### 10.6 Incident: "paid but order still PENDING"

Follow these steps in order — do **not** manually flip payment status until step 5.

1. **Confirm the payment is real.** In the gateway dashboard, locate the payment by
   `gatewayOrderId` / `gatewayPaymentId` and confirm `captured`/`paid`.
2. **Find the order** in the database by `gatewayOrderId` or the gateway's `notes.appOrderId`.
   Record its current `paymentStatus` and `orderStatus`.
3. **Check webhook delivery.** In the gateway dashboard, find the webhook attempt and its
   response:
   - **400 Invalid signature** → secret mismatch. Fix `RAZORPAY_WEBHOOK_SECRET`
     ([§10.2](#102-webhook-secret-rotation)) and replay.
   - **500 Database processing failed** → DB incident; check DB health
     ([§13.3](#133-database-connection-exhaustion)) and replay after recovery.
   - **No delivery at all** → endpoint URL wrong/unreachable, or the event is not subscribed.
4. **Replay the webhook** from the gateway dashboard (preferred) or with a signed test
   request. The handler is idempotent, so replaying an already-processed event is safe.
5. **Only if replay cannot succeed** (e.g. the gateway cannot resend), reconcile manually with
   an audited, single-row update executed by the owner, and record the gateway payment id in
   `gatewayPaymentId`/`gatewaySignature`. Never bulk-edit payment status.
6. **Notify the customer** if a receipt was not sent; the confirmation email is best-effort
   and this flow has a known defect where the queue handler logs instead of sending
   ([`./AUDIT.md`](./AUDIT.md) P0-5).
7. **Post-incident:** file a fix so the next occurrence does not require manual steps.

> **Reminder:** the POS/Express webhook path and the Next webhook path each enqueue KDS/email
> work into their **own in-process** queue. With more than one instance, that work is
> unreliable until the durable outbox lands (B3, [§11](#11-background-jobs--cron)).

---

## 11. Background jobs & cron

### 11.1 Current implementation (defect)

`lib/queue/job-queue.ts` is a **single-process** `JobQueue`: an in-memory array drained by a
`setInterval`, with exponential backoff (`2^attempt * 500ms`), a DLQ, and
`getDeadLetterQueue()` / `retryFromDlq()` helpers. Handlers live in `lib/queue/handlers.ts`
(`KDS_BROADCAST`, `WEBHOOK_OUTBOUND`, `EMAIL_DISPATCH`).

**Defect (B3):** the queue is in-process. On serverless it is frozen between requests and never
drains reliably; on any multi-instance deployment, jobs enqueued on instance A are invisible
to instance B; every deploy loses the queue. `JobQueue.getMetrics()` also reports
`processing: 0|1` and process-local counters, so queue metrics are not meaningful under
concurrency ([`./AUDIT.md`](./AUDIT.md) P2-7).

### 11.2 Target model: durable DB-backed outbox **[PROPOSED]**

Per owner decision, background work becomes a **durable, database-backed outbox** drained by a
worker:

```
Mutation txn ──▶ INSERT outbox row(s)  (+ commit)
Worker (or Vercel Cron) ──▶ claim batch (FOR UPDATE SKIP LOCKED)
                          ──▶ execute handler (KDS broadcast / email / webhook)
                          ──▶ mark COMPLETED or schedule retry; DLQ after max attempts
```

Design constraints:
- Enqueue inside the same transaction that mutates the order, so state and intent commit
  together.
- Claim rows with `SELECT ... FOR UPDATE SKIP LOCKED` so multiple workers do not double-process.
- Retries with backoff and an attempt cap; on exhaustion move to a dead-letter table with the
  full payload.
- Handlers must be idempotent (they will be retried).

### 11.3 Vercel Cron **[PROPOSED — not configured in the repository]**

There is no `crons` entry in `vercel.json` today. **[PROPOSED]** add a cron that invokes an
authenticated drain endpoint every minute, e.g.:

```jsonc
// PROPOSED addition to vercel.json — NOT currently present.
{
  "crons": [
    { "path": "/api/internal/outbox/drain", "schedule": "* * * * *" }
  ]
}
```

The drain endpoint must be authenticated (a shared secret header or S2S key) and must fail
closed. Vercel Cron alone is not sufficient for sub-minute latency; the always-on worker
(Target B/C) is the primary drainer, with cron as a safety net.

### 11.4 Monitoring queue depth and lag

| Metric | Target | Where | Action if breached |
| :--- | :--- | :--- | :--- |
| Queue depth (pending outbox rows) | Steady-state < 50 | Outbox table / metrics endpoint | [§13.6](#136-kitchen-display-not-updating) / scale worker |
| Queue lag p95 | **< 60 s** | Row age at drain | Page on-call; check worker health |
| DLQ size | 0 in steady state | DLQ table (`getDeadLetterQueue()` today) | Inspect and replay ([§11.5](#115-dead-letter-inspection-and-replay)) |
| Webhook delivery failures | < 0.5% | Handler outcome logs | [§13.5](#135-payment-webhooks-failing) |

### 11.5 Dead-letter inspection and replay

With the current in-process queue:
- Inspect: `globalJobQueue.getDeadLetterQueue()` returns the DLQ array (process-local).
- Replay: `globalJobQueue.retryFromDlq(jobId)` resets attempts and re-enqueues.
- **Caveat:** both operate only on the current process; a restart loses the DLQ. Capture the
  DLQ contents (log them) before any restart or deploy.

With the **[PROPOSED]** outbox: query the DLQ table, inspect `payload` and `lastError`, fix the
root cause, then replay by resetting status/attempts in a **single audited** update. Never
blind-replay a DLQ whose failure cause is unknown — you will amplify the failure.

---

## 12. Monitoring, health checks and alerting

### 12.1 Liveness vs readiness

| Probe | Endpoint | Checks | Behaviour |
| :--- | :--- | :--- | :--- |
| **Liveness** (Next) | `GET /api/health` | Returns `{ status, timestamp }`; **no DB/Redis check** | Restart only if the process is unresponsive, not on a DB blip |
| **Liveness** (Express) | `GET /health`, `GET /api/health` | `SELECT 1` | `503` + `{ status: "unhealthy" }` when the DB is unreachable |
| **Readiness** **[PROPOSED]** | e.g. `GET /api/ready` | **DB AND Redis** | Return `degraded` (still 200, still serving) when only Redis is down; `503` only when the DB is down. **Does not exist yet.** |

The Next `/api/health` handler deliberately does minimal work, so it is a liveness probe, not a
readiness probe. Do not wire it to a load-balancer "remove instance" decision without adding the
readiness route.

### 12.2 SLO table

| SLO | Target | Measured by |
| :--- | :--- | :--- |
| Availability (storefront) | **99.9%** monthly | Synthetic checks + edge analytics |
| Availability (admin API) | **99.5%** monthly | Route-handler error rate |
| Storefront TTFB p95 (cached) | **< 200 ms** | RUM + synthetic |
| API latency p95 | **< 250 ms read**, **< 500 ms write** | Structured logs |
| Error rate (5xx) | **< 0.5%** of requests | Log aggregation |
| Payment webhook success | **> 99.5%** within 5 min | Gateway report vs `Order` ledger |
| Job queue lag p95 | **< 60 s** | Outbox depth/lag metric |
| Data durability | **RPO ≤ 5 min**, **RTO ≤ 1 h** | Quarterly restore drill ([§8.7](#87-quarterly-restore-drill)) |

### 12.3 RED metrics per route

Track **R**ate, **E**rrors, **D**uration for each route handler and major Server Action:

- Rate: requests/route/window.
- Errors: 4xx and 5xx counts; 5xx is the SLO signal.
- Duration: p50/p95/p99; alert on p95 breaches.

Plus the platform metrics: queue depth, outbox lag, cache hit ratio, DB pool saturation, SSE
connection count, failed webhook count ([`./MASTER_PLAN.md`](./MASTER_PLAN.md) §12).

### 12.4 Alert-to-runbook matrix

| Alert | Likely cause | First action | Runbook |
| :--- | :--- | :--- | :--- |
| Storefront 5xx > 0.5% | Deploy regression, DB down | Check recent deploy; roll back if correlated | [§13.1](#131-site-down), [§13.2](#132-elevated-5xx) |
| Site entirely unreachable | DNS/TLS/platform outage | Check Vercel status + DNS | [§13.1](#131-site-down) |
| DB connections saturated | Pool unbounded / traffic spike | Shed load, add pooler, check long queries | [§13.3](#133-database-connection-exhaustion) |
| Slow queries spiking (`db.slow_query`) | Missing index / lock / bloat | `EXPLAIN`, kill blocking queries | [§13.4](#134-slow-queries) |
| Payment webhooks failing | Secret mismatch / endpoint down | Verify signature + URL, replay | [§13.5](#135-payment-webhooks-failing) |
| KDS not updating | SSE broken / in-process bus | Check SSE connection + pub/sub | [§13.6](#136-kitchen-display-not-updating) |
| Emails not sending | `EMAIL_API_KEY` wrong name/unset | Verify `EMAIL_API_KEY` (not `RESEND_API_KEY`) | [§13.7](#137-emails-not-sending) |
| Redis errors | Upstash outage / bad token | Confirm degraded mode, fix token | [§13.8](#138-redis-outage) |
| Deploy failed / bad release | Build/migration failure | Roll back / revert migration | [§14](#14-rollback-procedures) |
| Suspected breach | Anomalous access, leaked secret | Contain, rotate, disclose | [§13.10](#1310-suspected-data-breach) |
| Queue lag p95 > 60 s | Worker down / backlog | Restart worker, inspect DLQ | [§11](#11-background-jobs--cron) |

Rule: every alert must link to a runbook entry. An alert without an action is deleted.

---

## 13. Incident runbooks

Each procedure is ordered; do them in sequence. Record start time, actions, and recovery time.

### 13.1 Site down

1. Confirm the outage independently (curl `/api/health`, load the storefront, check DNS/TLS).
2. Check the hosting provider's status page (Vercel) and your DNS provider.
3. Check whether the failure started immediately after a deploy; if so, roll back
   ([§14.1](#141-application-rollback)).
4. If `/api/health` returns healthy at the origin but the site is unreachable, the fault is
   DNS/CDN/TLS — not the app. Fix at the edge.
5. If the DB is unreachable, follow [§13.3](#133-database-connection-exhaustion) /
   [§8.6](#86-restore-procedure).
6. Communicate status; after recovery, write a short post-incident note.

### 13.2 Elevated 5xx

1. Identify the failing routes from logs (`level: "error"`, `route`, `outcome`, `durationMs`).
2. Correlate with the last deploy. If the 5xx began at deploy time, roll back first, diagnose
   second ([§14](#14-rollback-procedures)).
3. Check DB and Redis health ([§13.3](#133-database-connection-exhaustion),
   [§13.8](#138-redis-outage)).
4. Check for an upstream dependency failure (Razorpay/Stripe/Resend) in logs.
5. If a single route is at fault, consider disabling the feature via its `Setting`-backed flag
   ([§14.3](#143-feature-flag-disable)).
6. Confirm the 5xx rate returns below 0.5% before closing.

### 13.3 Database connection exhaustion

Symptoms: `too many connections`, `remaining connection slots are reserved`, Prisma connection
timeouts, widespread 5xx.

1. Check current connections:
   ```sql
   SELECT count(*), state FROM pg_stat_activity GROUP BY state;
   SELECT pid, state, query_start, left(query, 120) FROM pg_stat_activity
   WHERE state <> 'idle' ORDER BY query_start;
   ```
2. Identify long-running or idle-in-transaction sessions. Terminate only ones you can attribute
   to a runaway query or a dead app instance:
   ```sql
   SELECT pg_terminate_backend(pid) FROM pg_stat_activity
   WHERE state = 'idle in transaction' AND query_start < now() - interval '5 min';
   ```
3. Reduce app concurrency / scale down instances so each instance's pool cannot multiply the
   problem. `lib/db/prisma.ts` has no pool bounds today, so an instance can open many
   connections ([§15.3](#153-pool-sizing-rules)).
4. Put Postgres behind a **pooler in transaction mode** so app connections are multiplexed.
5. Raise `max_connections` only as a last resort; prefer pooling. Raising it without RAM to
   back it will make things worse.
6. Post-incident: add explicit pool bounds (`max`, idle/connection timeouts, `statement_timeout`)
   to `lib/db/prisma.ts` ([`./AUDIT.md`](./AUDIT.md) P1-2).

### 13.4 Slow queries

1. Find the offenders. Prisma logs `db.slow_query` for anything over 150 ms; the build log
   already shows `Dish.findMany` at ~195 ms.
2. Inspect the plan:
   ```sql
   EXPLAIN (ANALYZE, BUFFERS) <the slow query>;
   ```
3. Look for sequential scans, in-memory sorts, and `OR` filters over nullable columns
   (`OR: [{ tenantId }, { tenantId: null }]` defeats index seeks).
4. Add/adjust an index as a new migration ([§8.3](#83-schema-change-policy)); the menu query's
   shape wants `(categoryId, isAvailable, deletedAt, sortOrder)`.
5. Check for lock waits (`pg_locks`, `pg_stat_activity.wait_event_type = 'Lock'`) and index
   bloat (`pg_stat_user_indexes`, bloat estimates).
6. Re-measure after the change; record the before/after plan.

### 13.5 Payment webhooks failing

1. In the gateway dashboard, read the webhook response code for the failing attempts.
2. **400 Invalid signature:** confirm `RAZORPAY_WEBHOOK_SECRET` matches the dashboard. Note the
   fallback to `RAZORPAY_KEY_SECRET`; a mismatch on either causes 400. Rotate per
   [§10.2](#102-webhook-secret-rotation), then replay.
3. **404/502/connection:** the endpoint URL is wrong or the host is down. Confirm
   `https://<domain>/api/v1/webhooks/payment` resolves and that the host is up
   ([§13.1](#131-site-down)).
4. **500:** database or handler error. Check logs (`webhook.payment.db_error`) and DB health,
   then replay.
5. Replay from the dashboard (idempotent). Confirm a duplicate replay returns `200
   "Already processed"` and changes nothing.
6. If a customer paid but the order is stuck, continue with
   [§10.6](#106-incident-paid-but-order-still-pending).

### 13.6 Kitchen display not updating

1. Confirm the SSE connection: the KDS client shows a `connected` handshake event; missing →
   auth failure (401) or a network block.
2. Check the heartbeat: Express sends a `ping` every 25 s; Next sends `: ping` every 20 s.
   No heartbeat → the connection is dead; the client should reconnect.
3. **Multi-instance check (B3):** if the KDS is connected to one instance but the order was
   created on another, the in-process `EventEmitter` cannot deliver it. This is the known
   defect. Mitigation today: single instance per tenant, or restart both processes after
   confirming this is the cause. Durable fix: Redis pub/sub on `tenant:<tenantId>`
   ([§9](#9-redis-operations)).
4. **Tenant-key check:** events are published on `tenant:<tenantId>`. A publish using a
   tenant **slug** (e.g. `tenant:spice-saffron`) will never reach a subscriber registered with
   the tenant **UUID** ([`./AUDIT.md`](./AUDIT.md) P2-8). Verify the tenant id used on both
   sides matches.
5. If necessary, force the client to re-fetch current ticket state while the fix lands.

### 13.7 Emails not sending

1. **First check the variable name.** The code reads `EMAIL_API_KEY`. If the deployment set
   `RESEND_API_KEY` (as the README suggests), email is silently disabled. Set
   `EMAIL_API_KEY` ([§7.1](#71-documentation-discrepancy-email_api_key-vs-resend_api_key)).
2. Confirm `CONTACT_NOTIFY_EMAIL` is set for contact notifications (both variables are
   required). `EMAIL_FROM_ADDRESS` is optional and defaults to the Resend onboarding sender.
3. Check the Resend dashboard for bounces, quota, or an unverified domain.
4. Check application logs for `contact.notify` with `result: "failed"` and the HTTP status.
5. **Order receipts specifically:** the queue handler currently only logs instead of sending
   ([`./AUDIT.md`](./AUDIT.md) P0-5), and the queue is in-process (B3). Do not assume a
   receipt was sent because the log says `email.dispatched`. Verify in the provider.
6. Send a test contact submission and confirm delivery end to end.

### 13.8 Redis outage

1. Confirm the app is degrading, not failing: orders must still succeed. If orders are failing,
   treat it as a checkout incident and escalate immediately.
2. Confirm the app is logging loudly on fallback. If it silently fell back, that is the defect —
   capture it and proceed.
3. Check the Upstash dashboard for an outage/quota issue and confirm the REST URL/token are
   correct.
4. If the token was rotated, restore the correct value and redeploy.
5. Do **not** flush the keyspace during an incident unless you have confirmed the keys are
   purely cache. Rate-limit and idempotency keys may be sharing the database.
6. After recovery, warm the menu cache and confirm `X-Cache-Lookup: HIT`.

### 13.9 Failed deploy / rollback

1. Read the build log. Distinguish: dependency install failure, `prisma migrate deploy` failure,
   `next build` failure, or a runtime failure after a green build.
2. Migration failures must be resolved **forward**; do not edit the failed migration. Correct it
   with a new migration ([§8.3](#83-schema-change-policy)).
3. If the previous release was healthy, roll back the application
   ([§14.1](#141-application-rollback)).
4. If a migration already applied and is incompatible with the old code, expand→contract is
   the only safe path; roll back code only if the schema remains backward-compatible.
5. Re-run `npm run verify:prod` after the rollback.

### 13.10 Suspected data breach

Treat as a security incident. Use [`../SECURITY.md`](../SECURITY.md) for the disclosure process.

1. **Contain.** Rotate the credentials most likely involved first: `AUTH_SECRET`, database
   password, payment keys, Redis token, email key, storage keys ([§13.11](#1311-leaked-secret-rotation)).
   Invalidate all sessions by rotating `AUTH_SECRET`.
2. **Preserve evidence.** Snapshot logs and the database **before** cleanup. Do not delete
   anything that might be evidence.
3. **Assess scope.** Which tenants/rows were accessed? Which endpoints? Use the immutable
   `ActivityLog` audit trail and access logs.
4. **Determine what data was exposed.** Map affected personal data (names, emails, phones,
   order history) per [`./MASTER_PLAN.md`](./MASTER_PLAN.md) §11 PII list.
5. **Notify.** Follow applicable legal obligations for affected individuals and authorities.
   This is a personal-use project with an owner-operated platform; the owner makes the call and
   records it.
6. **Remediate.** Fix the root cause (patch, config, secret scope), then re-verify the negative
   test case.
7. **Disclose responsibly.** Reporters use GitHub Private Vulnerability Reporting or the
   `[SECURITY]` email subject line in [`../SECURITY.md`](../SECURITY.md).
8. **Post-mortem.** Written timeline, root cause, and the control that would have prevented it.

### 13.11 Leaked secret rotation

1. Identify the secret class and blast radius:

   | Secret | Rotate | Blast radius if leaked |
   | :--- | :--- | :--- |
   | `AUTH_SECRET` | Immediately | Session forgery; rotate and invalidate all sessions |
   | `DATABASE_URL` password | Immediately | Full DB read/write; rotate role password, review access logs |
   | `RAZORPAY_KEY_SECRET` / `STRIPE_SECRET_KEY` | Immediately | Payment API abuse |
   | `RAZORPAY_WEBHOOK_SECRET` | Immediately | Forged webhooks → fake "paid" |
   | `UPSTASH_REDIS_REST_TOKEN` | Immediately | Cache/rate-limit/idempotency tampering |
   | `EMAIL_API_KEY` | Within 24 h | Email abuse via your domain |
   | Storage keys | Immediately | Bucket read/write/delete |

2. Generate a new value (`openssl rand -base64 32` for `AUTH_SECRET`; the provider's UI for
   gateway/Redis/email).
3. Update the environment in **every** environment and redeploy/restart.
4. Revoke the old value at the provider.
5. Confirm the system is healthy (`npm run verify:prod`, a test login, a test webhook).
6. Remove the secret from any logs, tickets, or chat where it leaked.
7. Record the rotation, and check for unauthorized use during the exposure window.

---

## 14. Rollback procedures

### 14.1 Application rollback

- **Vercel:** promote the previous successful deployment (Instant Rollback) or redeploy the
  last good commit. This is the fastest application-level mitigation.
- **Self-hosted (Target B/C):** redeploy the previous image/tag and restart the processes. Keep
  the last two known-good images available.
- After rollback, run `npm run verify:prod` and confirm the 5xx rate and payment webhooks
  recover.

### 14.2 Migration rollback (and why forward-only is preferred)

`prisma migrate deploy` is **forward-only**. Prisma does not auto-generate down-migrations, and
editing an applied migration corrupts the `_prisma_migrations` checksum.

Preferred path: **roll forward** with a corrective migration. If a migration must be undone:

1. Prefer an **expand→contract** design so the previous code still runs against the new schema
   (rollback the code, leave the schema).
2. If a column/table must be removed, write a **new** migration that reverses the change.
3. Never drop a column that holds data without a verified backup ([§8.5](#85-backups)).
4. For a destructive change already applied, restore from backup only as a last resort
   ([§8.6](#86-restore-procedure)) — it costs the RPO window.

`npx prisma migrate status` tells you what is applied; `prisma migrate resolve` marks a failed
migration as rolled back (use only with the DB in a known-good state).

### 14.3 Feature-flag disable

The fastest mitigation for a risky feature is to disable it without a deploy. The system
intends a `Setting`-backed flag store ([`./MASTER_PLAN.md`](./MASTER_PLAN.md) §7). Until every
risky path is flag-wrapped:

1. Toggle the relevant `Setting` row.
2. Confirm the feature is off for the affected tenant(s).
3. Keep the code deployed so re-enabling is instant.

Order of mitigation speed: **feature flag → application rollback → migration roll-forward →
restore from backup.**

---

## 15. Scaling operations

### 15.1 When to scale the app tier

Scale the app tier (add instances/lambda concurrency) when:

- Request latency degrades with load while DB and Redis are healthy.
- CPU/memory saturation correlates with traffic.
- Traffic is spiky and reads dominate (cache/ISR absorbs most of it).

Do **not** scale the app tier to fix a database bottleneck — that multiplies connections
([§13.3](#133-database-connection-exhaustion)).

### 15.2 When to add a read replica

Add a read replica when:

- Reporting/dashboard/sitemap/analytics reads compete with transactional writes.
- Read p95 degrades while write throughput is fine.
- You need to run `EXPLAIN`/analytics without touching the primary.

Route reporting and analytics reads to the replica; keep all transactional reads/writes on the
primary. Be explicit about replica lag for "my orders" style reads.

### 15.3 Pool sizing rules

| Runtime | Pool `max` | Notes |
| :--- | :--- | :--- |
| Serverless (Vercel) | **1–5** per instance, behind a pooler in transaction mode | Every instance is its own pool; the pooler multiplexes |
| Long-lived worker (Express) | **10–20** | One stable process; keep below Postgres `max_connections` headroom |
| Local dev | Small (2–5) | Avoid exhausting a shared local Postgres |

Also set `idleTimeoutMillis`, `connectionTimeoutMillis`, and `statement_timeout`, and set
`application_name` for observability ([`./DATABASE.md`](./DATABASE.md)). These are **not**
configured today (`lib/db/prisma.ts` has no bounds).

### 15.4 Cache/ISR tuning

- **Storefront:** ISR/PPR for marketing/catalog pages; tag-based revalidation; long-lived
  immutable caching for hashed assets; `stale-while-revalidate` for HTML.
- **API:** Redis cache-aside for hot reads (menu at 300 s). Invalidate on CMS writes.
- **Watch the cache hit ratio.** With in-process cache it collapses to ~1/N; Redis fixes this.
- Revisit TTLs against observed hit ratio and staleness tolerance; a longer TTL is a correctness
  trade-off, not a free win.

---

## 16. Routine maintenance calendar

| Cadence | Task | Command / action |
| :--- | :--- | :--- |
| **Daily** | Verify the latest backup completed; check restore-point age ≤ RPO | Provider dashboard |
| **Daily** | Review error logs and 5xx rate; investigate anything above 0.5% | Log platform |
| **Daily** | Check queue depth/lag and DLQ size | Metrics endpoint / outbox table |
| **Daily** | Confirm webhook success rate > 99.5% | Gateway dashboard vs ledger |
| **Weekly** | Dependency audit | GitHub Actions `security.yml` runs `npm audit --audit-level=critical` (Mondays 04:00 UTC); review output |
| **Weekly** | Review `db.slow_query` warnings from the week | Logs |
| **Weekly** | Confirm Redis key count and cache hit ratio are stable | Upstash dashboard |
| **Monthly** | Index bloat and unused-index check | `pg_stat_user_indexes`, bloat estimate |
| **Monthly** | Review SLO burn-down vs targets | Dashboard |
| **Monthly** | Rotate nothing by default, but confirm no secret is older than its cadence | Secret inventory |
| **Quarterly** | **Restore drill** ([§8.7](#87-quarterly-restore-drill)) | Manual |
| **Quarterly** | Secret rotation pass (`AUTH_SECRET`, Redis token at 90 days; payment secrets at 180 days) | Provider UIs |
| **Quarterly** | DR test: failover/fail-back rehearsal; validate RTO/RPO | Combined with restore drill |
| **Quarterly** | Review this runbook against incidents that occurred; update it | — |
| **Annual** | Re-verify DR assumptions, retention policy, and least-privilege roles | — |

> The weekly `npm audit` threshold is `--audit-level=critical`; the master plan recommends
> raising it to `high` and adding Dependabot, gitleaks and a lockfile-integrity check
> ([`./AUDIT.md`](./AUDIT.md) P3-6).

---

## 17. Troubleshooting FAQ

### 17.1 ~~`next build` fails on `@vercel/blob`~~ (resolved 2026-10-15)

The upload handler no longer references `@vercel/blob`, so the build warning is gone. If you now
see a storage-related build error, it is a malformed `STORAGE_PUBLIC_URL` — `next.config.ts`
parses it to authorise `next/image` and the CSP. Fix the URL or unset it (remote images are then
simply not optimised).

### 17.2 Uploads return 503 in production

**Cause:** no object store is configured, so `resolveStorage()` fails closed. This is
intentional — the previous behaviour (writing base64 `data:` URLs into Postgres) is gone.

**Fix:** set `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` and
`STORAGE_PUBLIC_URL`. In development, uploads use the local filesystem under `public/uploads`
(git-ignored) and are lost on redeploy — that is expected outside production.

**If you have legacy `data:` URLs**, find and migrate the bytes out:

```sql
SELECT id, name FROM "Dish" WHERE image LIKE 'data:%';
SELECT id, url  FROM "GalleryImage" WHERE url LIKE 'data:%';
```

### 17.3 SSE works locally but not in production

**Causes:**
- The SSE endpoint is Express-only in some deployments, but `vercel.json` deploys Next only
  (B4). Use the Next Route Handler `app/api/v1/realtime/kds/route.ts` in production.
- The event bus is in-process (B3). On multiple instances, a ticket created on instance A never
  reaches a KDS client on instance B. Fix requires Redis pub/sub.
- The tenant key mismatches: publish uses a slug, subscribe uses a UUID
  ([`./AUDIT.md`](./AUDIT.md) P2-8).
- A proxy buffers the stream. The Next route sets `X-Accel-Buffering: no`; ensure your proxy
  (Nginx) is not buffering `text/event-stream`.

### 17.4 500s only in production

**Checklist:**
- Missing/invalid `DATABASE_URL` or `AUTH_SECRET` at runtime.
- `UPSTASH_REDIS_REST_URL`/`_TOKEN` absent → memory fallback (works, but state
  diverges). Order ingestion is the exception: it returns `503` in production so
  duplicates cannot be accepted.
- `NODE_ENV=production` enables stricter webhook signature verification; a missing
  `RAZORPAY_WEBHOOK_SECRET` means valid-looking requests are rejected.
- Read-only filesystem breaks local upload writes.
- Security headers/CSP differ from dev.
- Reproduce with `npm run build && npm start` locally, then `npm run verify:prod`.

### 17.5 Prisma "too many connections"

See [§13.3](#133-database-connection-exhaustion). Root cause is the unbounded pool in
`lib/db/prisma.ts` multiplied by instance count. Fix with a pooler in transaction mode and
explicit pool bounds ([§15.3](#153-pool-sizing-rules)).

### 17.6 Playwright fails on CSRF origin

The web server's `APP_URL` must equal the origin Playwright serves (`http://localhost:3100` by
default via `E2E_PORT`). `playwright.config.ts` sets
`APP_URL: http://localhost:${PORT}` and starts `npx next start -p ${PORT}`. If you change the
port, keep `APP_URL` in lockstep, or CSRF origin checks reject mutations. Also keep the
rate-limit overrides (`LOGIN_RATE_MAX=100`, `CONTACT_RATE_MAX=50`) so the suite does not lock
itself out.

### 17.7 `vitest` Vite ESM-in-CJS warning

`vitest.config.ts` emits a Vite ESM-in-CJS deprecation warning; it is a forward-compatibility
warning, not a test failure ([`./AUDIT.md`](./AUDIT.md) P3-6). It will become an error under a
future Vite default; treat it as a scheduled fix (Phase 5/8), not an incident.

### 17.8 Where did the `data:` URL come from?

If `Dish.image` or `GalleryImage.url` is a `data:image/...;base64,...` string, an upload ran
through the fallback path ([§17.2](#172-uploads-vanish-after-a-deploy)). Migrate the asset to
object storage and update the row to a URL.

### 17.9 `npm run verify:prod` fails on `/api/health`

The script requires `json.status === "healthy"`. If it fails:
- The Next handler returns healthy by default; a failure usually means the deploy is down or a
  proxy intervened. If you point the script at the **Express** `/api/health`, a DB outage
  returns `503`/`unhealthy` by design.

### 17.10 An admin cannot log in

1. Confirm a super admin exists: re-run `npm run create-admin` with the same email (it resets
   the password and reactivates the account).
2. Confirm `AUTH_SECRET` has not changed unexpectedly — rotating it invalidates existing
   sessions but does not break password login.
3. Confirm cookies are `Secure` in production (requires HTTPS); check the browser is storing
   `cafe_session`.
4. `/admin` redirects to `/admin/login` when there is no `cafe_session` cookie (`proxy.ts`);
   that redirect is expected, not an error.

---

## 18. Related documents

- [Master Plan](./MASTER_PLAN.md) — target architecture, SLOs, risk register.
- [Architecture](./ARCHITECTURE.md) — layered model and the two-runtime contract.
- [Database](./DATABASE.md) — schema, indexing, pooling, backup/restore detail.
- [Audit](./AUDIT.md) — the verified defects referenced throughout this runbook.
- [Roadmap](./ROADMAP.md) — phased remediation (Phase 7 = observability & ops).
- [Testing](./TESTING.md) — unit/integration/e2e strategy.
- [Security Policy](../SECURITY.md) — disclosure, hardening checklist.
- [README](../README.md) — stack overview and getting started (note the documented
  `RESEND_API_KEY` discrepancy, [§7.1](#71-documentation-discrepancy-email_api_key-vs-resend_api_key)).

---

© 2026 Himanshu. All Rights Reserved.
