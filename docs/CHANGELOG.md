# CHANGELOG.md

All notable project changes. Format: Phase — description.

## Phase 0 — Project preparation

- Created AI memory documentation system (`docs/`): BRAIN, MEMORY, PROJECT_OVERVIEW, MASTER_PLAN, ARCHITECTURE, DESIGN_SYSTEM, DATABASE_SCHEMA, API_SPECIFICATION, SECURITY, VALIDATION_RULES, TESTING, DEPLOYMENT, SEO, ACCESSIBILITY, PERFORMANCE, COMPONENT_RULES, CONTENT_GUIDE, ADMIN_GUIDE, TROUBLESHOOTING.
- Created local PostgreSQL database `indian_cafe`.
- Locked architecture: Next.js App Router + Prisma + PostgreSQL + server-side auth (Argon2id + sessions).

## Phase 1 — Foundation

- Scaffolded Next.js 16.3.1 + TypeScript + Tailwind CSS v4.
- Design tokens in `app/globals.css` (colors, Fraunces display + Geist sans typography, spacing, radius, shadows).
- Config layer: `config/site.ts`, `config/navigation.ts`, `config/seo.ts`, `config/limits.ts`, `config/roles.ts` (SUPER_ADMIN > ADMIN > EDITOR permission matrix).
- Root layout with fonts, JSON-LD `Restaurant` schema, metadataBase.
- Error/loading/not-found states, sitemap.xml, robots.txt.

## Phase 2 — Database

- Prisma schema v7 (`@prisma/adapter-pg`): Admin, Session, Category, Dish, GalleryImage, ContactMessage, ActivityLog, Setting.
- Migration applied to local PostgreSQL; seed data via `prisma db seed` (6 categories, 11 dishes, gallery, settings, admin account).

## Phase 3 — Authentication

- Argon2id password hashing (`lib/auth/passwords.ts`).
- Server-side sessions: random 32-byte tokens, HttpOnly + Secure + SameSite=Lax cookies, 24h sliding expiry, server-side invalidation on logout (`lib/auth/session.ts`).
- Route guards: `requireAdmin()`, `requirePermission()` (`lib/auth/guards.ts`).
- Login API with Zod validation, rate limiting (5/15min per IP+account), generic error messages (no account enumeration). Logout API invalidates session server-side.

## Phase 4 — API routes

- `/api/health`, `/api/auth/login`, `/api/auth/logout`, `/api/contact`.
- Contact: Zod validation, rate limit 3/10min per IP, honeypot field, minimum form-time guard, hashed IP storage, silent success for spam bots.

## Phase 5 — UI primitives + public layout

- UI primitives under `components/ui/`: button (cva variants), input, textarea, label, badge, skeleton, modal (focus trap + Escape), select, toast (provider + hook), form-field.
- `SiteHeader` (mobile drawer + desktop nav) and `SiteFooter` (settings-driven) composed in `(public)` route group layout.

## Phase 6 — Public pages

- Home: hero, featured dishes, about preview, menu highlights, gallery preview, why visit.
- Menu (DB-driven with category tabs), dish detail `/menu/[slug]`, about, gallery, contact (validated form), FAQ, privacy, terms.

## Phase 7 — TypeScript fixes

- All `tsc --noEmit` errors resolved; `npm run typecheck` passes clean.

## Phase 8 — Admin dashboard

- Auth-gated `(panel)` route group with `requireAdmin()` + `force-dynamic`; admin shell navigation.
- Dashboard overview with stats from DB.
- Categories CRUD, dishes CRUD (featured/availability toggles, soft delete), gallery manager, messages inbox (NEW → READ → REPLIED → ARCHIVED workflow), settings editor, read-only activity log.
- Every server action guarded by `requirePermission()`, rate-limited per admin, Zod-validated, audit-logged, revalidates affected paths.

## Phase 9 — Performance + caching

- ISR on public pages (5-minute revalidate); cached services for settings/menu/gallery with tag-based invalidation after admin mutations.

## Phase 10 — Security hardening

- Security headers via `next.config.ts`: Content-Security-Policy (self-hosted, no eval in production), X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, HSTS; `poweredByHeader` disabled.
- Added `proxy.ts` (Next.js 16 middleware successor): cookie-presence gate on `/admin/*` returning clean 307 → `/admin/login` before render; authoritative checks remain in `requireAdmin()`/`requirePermission()`.
- Verified end-to-end: anonymous `/admin/*` → 307 to login; login sets HttpOnly session cookie and returns no hash material; wrong password → generic 401; authed dashboard loads.
- Verified: all admin actions independently check session + permission; rate limits on login/contact/admin mutations; no raw SQL; no unsanitized HTML rendering; secrets server-only.

## Phase 11 — CI/CD

- `.github/workflows/ci.yml`: Postgres service container → install, prisma generate, migrate deploy, seed, lint, typecheck, unit tests, production build.
- `.github/workflows/security.yml`: npm audit (prod deps fail on high+, all deps on critical), weekly scheduled run.

## Testing

- Vitest unit suites passing (21 tests): validation schemas, utils (slugify/formatPrice), role permissions.
- Integration suite (Phase 12): isolated `indian_cafe_test` database auto-created and migrated by a vitest globalSetup — dev data is never touched. Suites cover Argon2id hashing + full session lifecycle (token hashed at rest, expiry deletion, deactivated admin rejection, logout/revocation), dish/category service behavior (slug uniqueness, soft delete visibility, availability/featured toggles with audit rows, reorder transaction, category-not-empty guard), contact message workflow (status transitions, filtering, pagination, stats), and rate-limiter blocking/window-reset semantics.
- Security suite (Phase 12): mass-assignment payloads (`role`, `isAdmin`, `actorId`, `deletedAt`) stripped by Zod schemas; list-query sort fields whitelisted; XSS/SQLi payloads stored as inert data; honeypot enforcement; control-character stripping; phone/slug/price bounds; non-uuid category references rejected.
- Fixed `emailSchema`: trim + lowercase now run before format validation, so `" User@Example.Com "` normalizes instead of being rejected (found by tests).
- Total: 74 tests passing across unit, integration, and security suites.

## Phase 13 — Deployment preparation

- Initialized git repository (`main`); pre-commit secret scan clean (only CI-throwaway creds and documented dev-seed defaults tracked; `.env*`, generated client, and personal notes excluded).
- `package.json`: added `postinstall: prisma generate` so installs regenerate the gitignored client.
- Added `vercel.json`: build command `prisma migrate deploy && next build` (self-migrating deploys).
- Rewrote `docs/DEPLOYMENT.md` as a concrete go-live runbook: GitHub push steps, database provisioning, per-environment env-var matrix, production admin creation via `npm run create-admin`, pre-launch checklist.
- Re-ran §128 security audit against a production build: anonymous `/admin/*` → 307; wrong password → generic 401; forged session cookie → no admin data in response (render-time redirect only); `/.env`/`.env.local` → 404; all security headers present; contact honeypot → 422; `/api/health` leaks nothing.
- Initial commit: `22910f3`.

---

_Next up (manual): push to GitHub, provision prod/preview databases, import repo in Vercel, create production admin, replace placeholder images, run Lighthouse on the live domain._
