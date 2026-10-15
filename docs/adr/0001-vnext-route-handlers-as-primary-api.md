# ADR-0001: Next.js Route Handlers as the primary production API

| Field | Value |
| :--- | :--- |
| **Status** | Accepted |
| **Date** | 2026-10-15 |
| **Deciders** | Himanshu |
| **Supersedes** | _(none)_ |
| **Related** | [ADR-0002](./0002-redis-as-required-production-dependency.md), [ADR-0003](./0003-durable-outbox-job-queue.md) |

## Context

The platform ships two API surfaces:

- **Next.js Route Handlers** under `app/api/v1/*` — for example
  `app/api/v1/orders/route.ts`, `app/api/v1/menu/route.ts`,
  `app/api/v1/webhooks/payment/route.ts` — which deploy automatically with the
  Next.js application.
- **A standalone Express 5 service** in `server/api.ts` that listens on port
  `4000` (`server/api.ts:18`) and exposes menu, coupon, order, KDS-SSE and
  webhook endpoints intended for B2B partners and long-lived streaming.

The production deployment target is **Vercel**, configured in
[`vercel.json`](../../vercel.json) as a `nextjs` framework build. Vercel has **no
concept of port `4000`** and does not run a second, always-on process. As a
result the Express service is effectively dead in the default production
deployment: the B2B/KDS API documented in the top-level
[README.md](../../README.md) is unreachable there, and the two surfaces have
already begun to drift because each maintains its own copy of the pricing and
query logic (compare `app/api/v1/orders/route.ts:92-96` with
`lib/services/orders.ts:147-183`).

A second, related fact is that the shared domain logic already exists: the
`lib/services/*` layer (notably `lib/services/orders.ts`, `lib/services/audit.ts`,
`lib/services/inventory.ts`) is where Server Actions and business rules live.
The Route Handlers currently duplicate rather than reuse it.

## Decision

**Next.js Route Handlers under `app/api/v1/*` are the primary production API.**
The Express service in `server/api.ts` is **retained** for self-hosting,
long-running workers and local development. Both runtimes are to be **thin
adapters over the single shared `lib/services/*` domain layer**, so that pricing,
tenant resolution, validation and side effects are implemented exactly once.

- **Target:** every Route Handler and every Express route delegates to
  `lib/services/*`; no business logic lives in either transport layer.
- **Target:** a **contract test** asserts that the two runtimes return
  byte-identical responses for the same inputs, so they cannot silently drift.
  Until that test exists, drift is possible and should be treated as a defect.
- The Express process remains the supported path for self-hosted deployments and
  for work that needs a long-lived process (streaming SSE, long-running
  workers), which a request-scoped serverless function cannot provide.

## Consequences

### Positive

- The B2B and KDS API ships to production with the application: no second
  deployment, no port to expose, no separate URL to configure.
- One shared service layer means pricing, validation and business rules cannot
  diverge between the Next.js and Express surfaces.
- Route Handlers inherit Vercel's edge/CDN, automatic HTTPS, preview
  deployments and logging without extra infrastructure.
- A single service layer is materially easier to test than two parallel
  implementations.

### Negative

- Serverless Route Handlers are request-scoped and frozen between requests; they
  cannot host the long-lived worker that [ADR-0003](./0003-durable-outbox-job-queue.md)
  requires. Self-hosting remains necessary for that workload.
- Streaming (SSE KDS) behaves differently on a serverless function than on a
  long-running Express process and needs care around timeouts and connection
  lifetimes.
- The contract test must be written and kept green; it is the guardrail that
  makes "two thin adapters" safe, and its absence is a known risk today
  ("Not yet implemented").

### Neutral

- The public API shape (paths under `/api/v1/*`) is unchanged; only the host
  changes.
- Local development continues to run both processes via `npm run dev:all`.

## Alternatives considered

- **Two separately deployed services (Next.js + Express, both in production).**
  Rejected: more moving parts, a second host to pay for and monitor, and two
  deployments that must be kept in lockstep — the exact drift problem this ADR
  exists to prevent, only worse.
- **Full self-hosted Docker only.** Rejected: it forfeits the CDN, edge caching,
  preview deployments and managed TLS that make the storefront fast and cheap to
  operate.
- **Rewrite the Express API away entirely.** Rejected: it removes the only
  mechanism the platform has for self-hosting, long-running workers and
  long-lived SSE, which the roadmap still needs.

## References

- `app/api/v1/orders/route.ts` (Route Handler; duplicated pricing at lines 92-96)
- `server/api.ts` (Express service; port at line 18, tenant-filtered reads at
  lines 162-174 and 189-195)
- `lib/services/orders.ts` (shared domain logic, e.g. `createOrder`, lines 80-303)
- `app/api/v1/menu/route.ts`, `app/api/v1/webhooks/payment/route.ts` (sibling
  Route Handlers)
- [`vercel.json`](../../vercel.json) (`framework: nextjs`, `buildCommand`)
- [`README.md`](../../README.md) (dual-port architecture)
- [`../ARCHITECTURE.md`](../ARCHITECTURE.md), [`../MASTER_PLAN.md`](../MASTER_PLAN.md),
  [`../OPERATIONS.md`](../OPERATIONS.md)
- [`../adr/README.md`](./README.md)
