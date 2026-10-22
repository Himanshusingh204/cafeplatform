# Completion Plan (execution view)

> Status date: 2026-10-22. This is the working plan for finishing the platform. It sits on top
> of [`../MASTER_PLAN.md`](../MASTER_PLAN.md) (architecture) and [`../ROADMAP.md`](../ROADMAP.md)
> (phase detail). Phases 0 to 3 and most of Phase 4 are done; this plan covers what remains.

## 1. Where we are

Gates on the current tree: typecheck, lint, 47 test files (324 tests) and a clean production
build all pass. Storefront, admin, order pipeline, durable outbox, tenant hardening and the
Express/Next parity are in place.

## 2. What "fully ready" means

1. Production boot is safe: required config is validated, and a missing shared backend fails
   closed instead of silently degrading.
2. Every tenant-owned table is tenant-scoped, and plan limits are enforced.
3. Quality gates run in CI and hold a coverage floor, accessibility checks and a performance budget.
4. The service can be operated: health vs readiness, structured logs, request ids, metrics, runbooks.
5. The public site is fast and discoverable: optimized images, typed structured data, complete metadata.
6. Docs tell the truth and a new engineer can run, test and deploy it from the README.

## 3. Workstreams

| ID | Workstream | Roadmap | Scope (owns these paths) | Gate |
| :-- | :-- | :-- | :-- | :-- |
| W1 | Testing depth and dependency hygiene | Phase 5 | `tests/**` (new suites), `vitest.config.ts`, `.github/**`, `package.json`, lockfile, `playwright.config.ts` | coverage floor in CI, a11y smoke, audit state reported |
| W2 | SEO and performance | Phase 6 | `app/layout.tsx`, `app/**/page.tsx` metadata only, `lib/seo/**`, `config/site.ts`, `public/images/**`, `scripts/optimize-images.mjs`, `next.config.ts` images | typed JSON-LD from config, no image over 200 KB, metadata on every page |
| W3 | Observability and operations | Phase 7 | `lib/logger*`, `lib/observability/**`, `app/api/health/**`, `app/api/ready/**`, `server/routes/health.ts`, `docs/OPERATIONS.md` | liveness vs readiness, request-id logging, metrics endpoint, runbooks |
| W4 | Production safety and security | Phase 3 and 4 remainder | `lib/config/**`, `instrumentation.ts`, `lib/rate-limit/**`, `lib/realtime/**`, `proxy.ts`, security docs | boot validation, Redis decision enforced, gitleaks in CI |
| W5 | Multi-tenant completeness and plans | Phase 2 and 9 slice | `prisma/**`, `lib/db/**`, `lib/services/**`, `lib/plans/**`, `app/admin/actions/**`, tenant-related admin pages | `tenantId NOT NULL` everywhere, per-tenant uniques, plan quotas enforced |

Ordering rule: W5 is the only workstream that edits `prisma/` and the only one allowed to run
DB-backed tests while it works. W1 owns every `npm install`. The final gate (typecheck, lint,
full tests, coverage, clean build) is run once by the lead after all workstreams finish.

## 4. Explicitly out of scope (documented, not built)

- Phase 8 directory restructuring (`domain/`, `infrastructure/`): a large move with no user
  value; do it after the above ships, behind its own review.
- Billing provider integration and a self-serve tenant signup flow beyond the quota model.
- Row-level security: needs a database-role design decision first.

## 5. Risks

| Risk | Mitigation |
| :-- | :-- |
| Schema migration on live data | Expand, backfill, constrain; applied to the test DB only here; operator runs it deliberately |
| Fail-closed boot breaks a working deploy | Opt-in env flags documented in `.env.example` and `docs/OPERATIONS.md` |
| Concurrent agents edit the same files | Disjoint scopes above; lead merges and runs the gates |
