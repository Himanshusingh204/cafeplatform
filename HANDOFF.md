# HANDOFF — Spice & Saffron Indian Café Website

**Date:** August 23, 2026
**Status:** Phase 17 COMPLETE. Production-ready seed, comprehensive tests, all quality gates green. Ready to ship.
**Repo:** git initialized on `main`. Working tree clean after this commit.

---

## What this project is

A production-grade, premium Indian café website (Next.js 16.3.1 + TypeScript + Tailwind v4 + Prisma 7 + PostgreSQL) with a private admin CMS. Public site is fully database-driven; admin manages menu, gallery, messages, settings with role-based permissions.

## Verification status (all green)

| Check | Result |
|---|---|
| `npm run lint` | clean |
| `npm run typecheck` | clean |
| `npm test` | 95+ passing (unit + integration + security) |
| `npm run build` | succeeds; 13 static pages + dynamic routes |
| `npm run test:e2e` | 38/38 passing (chromium + mobile-chrome) |
| Lighthouse (local prod build) | Perf 90 · A11y 100 · BP 100 · SEO 100 |
| §128 security audit | all answers "No" (see CHANGELOG Phase 13) |
| Route smoke test | 14/14 correct status codes |

## Architecture quick reference

- **Auth:** Argon2id hashes (`lib/auth/passwords.ts`) → server-side sessions (`lib/auth/session.ts`, cookie `cafe_session`) → guards (`lib/auth/guards.ts`). `proxy.ts` = presence-only cookie gate (307 for anon `/admin/*`); real checks in render/actions.
- **Roles:** SUPER_ADMIN > ADMIN > EDITOR via `config/roles.ts`; every server action calls `requirePermission()`.
- **Caching:** ISR 5m on public pages; tag-based revalidation ("menu", "gallery", settings) after admin mutations.
- **Security headers:** `next.config.ts` (CSP self-hosted, no eval in prod; X-Frame-Options DENY; etc.). `poweredByHeader` off.
- **Rate limits:** login 5/15min, contact 3/10min, admin mutations per-admin (`config/limits.ts`).
- **Tests:** vitest unit/integration/security + Playwright E2E. Integration suites auto-create + migrate an isolated `indian_cafe_test` DB. Dev data never touched.
- **E2E:** Playwright 2 projects (chromium + mobile-chrome viewport 412×915). Serial execution. Env overrides: `LOGIN_RATE_MAX=100`, `CONTACT_RATE_MAX=50`.
- **Deploys:** `vercel.json` build command runs `prisma migrate deploy && next build`; `postinstall` regenerates the gitignored Prisma client.

## Read before modifying anything

1. `docs/BRAIN.md` — rules + architecture decisions
2. `docs/MEMORY.md` — stable facts (frozen to final state)
3. `docs/CHANGELOG.md` — what was done, phase by phase
4. `docs/DEPLOYMENT.md` — go-live runbook

## Remaining launch steps (need the owner's accounts)

1. **GitHub:** create repo, then:
   ```powershell
   git remote add origin https://github.com/<account>/spice-and-saffron.git
   git push -u origin main
   ```
   Enable branch protection + secret scanning + Dependabot.
2. **Databases:** provision production + preview Postgres (Vercel Postgres / Neon / Supabase). Never share prod DB with preview.
3. **Vercel:** import repo; set env vars per environment (matrix in `docs/DEPLOYMENT.md`): `DATABASE_URL`, `AUTH_SECRET` (fresh `openssl rand -base64 32`), `APP_URL`, optional `EMAIL_API_KEY`.
4. **Production admin:** point `DATABASE_URL` at prod DB locally, run `npm run create-admin` with generated credentials. Never reuse dev seed creds (`admin@spiceandsaffron.in` / `ChangeMe123!` are DEV ONLY).
5. **Content:** replace `public/images/placeholders/*` with real photography; remove seed demo dishes from prod DB.
6. **Final QA on live domain:** Lighthouse ≥90, `curl -I` header check, backup enablement + one restore test.

## Known non-blockers

- Forged-session requests get HTTP 200 with loading skeletons then a meta-refresh redirect (no data ever leaks; render-time guard handles it). Cosmetic only.
- Local Lighthouse numbers vary ±8 points run-to-run; measure on the deployed domain for truth.
- Rate limiter supports Upstash Redis (async) with in-memory fallback. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` for production. Interface is drop-in, see `lib/rate-limit/limiter.ts`.

## Deliberately out of scope (v1)

Reservations, online ordering, payments, QR menus, multi-location, customer accounts.

---

*Handoff prepared by the AI build session. The project is ready to ship.*
