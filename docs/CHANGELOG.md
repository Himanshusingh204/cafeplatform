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

## Launch polish

- Lighthouse audit (local production build): Performance 78 → **90** after switching `Reveal` to `LazyMotion` + `domAnimation` with `m.` components (`components/ui/reveal.tsx`); Accessibility / Best Practices / SEO all 100. FCP 1.7s → 1.1s, LCP 4.9s → 3.6s under simulated throttling.
- Full-route smoke test on production build: 14 routes return correct codes (200 / 404).
- Frozen AI memory docs to final state: `MASTER_PLAN.md` phase table, `PROJECT_OVERVIEW.md`, `MEMORY.md`.
- `HANDOFF.md` rewritten as the current-state handoff document.

## Design de-templatization pass

- Homepage audit against generic-pattern checklist; removed every uniform card-grid section: featured dishes now a broken zig-zag grid (6-col spans 4/2/2/4), category highlights a numbered ruled index (print-menu style), gallery preview an asymmetric staggered collage (varied aspect ratios, offset columns, editorial captions instead of repeated gradient overlays), "why visit" replaced icon-circle cards with a statement + ruled facts ledger.
- Hero: specific human copy ("Indian food, cooked the long way"), print-style offset frame behind image, photo caption instead of floating badge card; duplicate floating-badge trick removed from about preview (now portrait ratio + caption line).
- Closing CTA converted from lone centered button to ruled invitation band.
- About page values: three bordered cards → hairline-divided definition rows.
- Typography: display tracking tightened (-0.01em), `.eyebrow` + tabular-numeral utilities added, button press feedback (`active:scale`) added.
- Removed unused Next.js starter SVGs from `public/`.
- Verified: lint clean, typecheck clean, 74/74 tests passing, production build succeeds.

## Phase 14 — Contact email notifications

- Added `lib/email/notifier.ts`: Resend-backed owner notification for new contact messages, plain-text + escaped-HTML bodies (XSS-safe), `reply_to` set to the visitor so the owner can reply directly.
- Feature-flagged via env: sends only when both `EMAIL_API_KEY` and `CONTACT_NOTIFY_EMAIL` are set; optional `EMAIL_FROM_ADDRESS` override (defaults to Resend test sender). Unconfigured = silent no-op.
- Best-effort semantics wired into `/api/contact` after DB storage: notification failure is logged but never fails the visitor's submission.
- No new dependency (direct fetch to Resend API).
- Tests: 5 new unit tests (config gating, payload correctness + HTML escaping, API rejection, network error tolerance) → **79 tests total**.
- Docs: `.env.example`, `DEPLOYMENT.md` env matrix updated.

---

## Phase 15 — E2E testing & admin polish

- Set up Playwright (config, deps, vitest exclusion): 2 projects — chromium (desktop) + mobile-chrome (Pixel 7 viewport override).
- `tests/e2e/global-setup.ts`: migrates + seeds isolated `indian_cafe_test` DB via `execSync`.
- Public visitor flows (6 specs, 15 tests): homepage, menu, gallery, faq, contact, 404.
- Admin security + CRUD (4 specs, 23 tests): login, dashboard, category CRUD, dish CRUD, messages inbox.
- CI workflow `ci.yml`: added E2E job (postgres service, build, playwright test).
- Env-tunable rate limits (`LOGIN_RATE_MAX`, `CONTACT_RATE_MAX`) in `config/limits.ts` to unblock E2E suite.
- Admin panel design polish: sticky modal footers in dish-manager, category-manager, gallery-manager.
- Fixed dashboard dead code (no-op conditional), duplicate import in dishes page, incomplete sidebar nav icons (added UtensilsCrossed, FolderOpen, Image, Mail, Settings, Activity).
- Fixed unhandled promise rejections on dish availability/featured toggle actions.
- Moved settings action from `actions/messages.ts` to `actions/settings.ts` (proper separation).
- Added `app/admin/(panel)/loading.tsx` skeleton for admin panel navigation.
- Mobile-chrome viewport fix: explicit `412×915` with `hasTouch: true` instead of device preset (eliminates backdrop-blur click interception emulation artifact).
- Deleted `tests/e2e/probe.spec.ts` (debugging file no longer needed).

---

## Phase 16 — Polish, security hardening, real-time notifications

- **Bug fixes:** Contact form timing guard (was sending raw timestamp instead of elapsed seconds); Footer `JSON.parse` crash on malformed settings; `requirePermission` FORBIDDEN → `notFound()` instead of throwing error.
- **CI fix:** Added missing `prisma migrate deploy` + `prisma db seed` steps to E2E job in `.github/workflows/ci.yml`.
- **Rate limiter upgraded:** `lib/rate-limit/limiter.ts` now supports Upstash Redis (async) with in-memory fallback. All callers updated to `await`. Added `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` to `.env.example`.
- **Real-time notifications:** Added `/api/notifications` SSE endpoint for admin panel (polls for new messages every 10s, 30s heartbeat, auto-cleanup after 5min). Notification bell with unread badge in admin shell.
- **Mobile menu animation:** Framer Motion slide transition on `SiteHeader` mobile drawer (staggered nav items, height + opacity animation).
- **Gallery from database:** Homepage gallery preview now pulls published images from DB instead of hardcoded placeholders.
- **Dynamic sitemap:** `/sitemap.xml` now includes individual dish pages from database (with graceful fallback if DB unavailable).
- **Security hardening:** HMAC-signed CSRF tokens (`lib/security/csrf.ts`), cookie deduplication, `use-csrf` hook.
- **Pagination component:** Reusable `<Pagination>` for admin lists (`components/ui/pagination.tsx`).
- **Hooks directory:** `use-debounce.ts`, `use-media-query.ts` (SSR-safe via `useSyncExternalStore`), `use-toast.ts`, `use-notifications.ts`, `use-csrf.ts`.
- **Error boundary:** `app/(public)/error.tsx` with try-again and back-to-home.
- **Admin loading skeleton:** `app/admin/(panel)/loading.tsx` for panel navigation.
- **Lint/typecheck fixes:** `guardMutation` made `async`; hooks refactored to avoid `setState` in effects; build passes clean.

## Phase 17 — Production-ready seed, comprehensive tests

- **Production-ready seed:** `prisma/seed.ts` now uses `SEED_DEMO_DATA=true` env flag to include demo dishes/categories/gallery. Settings are always seeded. Admin name/role configurable via env vars.
- **New integration tests:** `tests/integration/settings.test.ts` (normalizeSettings, CRUD, audit logging, caching), `tests/integration/gallery.test.ts` (CRUD, NOT_FOUND guards, audit logging), `tests/integration/audit.test.ts` (logAction with all field combinations, action types).
- **New unit tests:** `tests/unit/csrf.test.ts` (HMAC token generation, validation, tampering rejection), `tests/unit/request-utils.test.ts` (hashIp consistency, IPv4/IPv6 handling).
- **New API tests:** `tests/integration/api-health.test.ts` (health endpoint status and timestamp).
- **Env configuration:** `.env.example` updated with seed configuration vars (`SEED_DEMO_DATA`, `CAFE_*` settings).

## Phase 18 — Final polish

- **AI-pattern fixes:** Removed duplicate tagline in footer, replaced oddly-specific hero timestamp with "Lunch service — Hauz Khas", fixed dish delete confirmation wording ("contact support" → honest soft-delete language).
- **Admin animation:** Added slide-in transition on mobile admin navigation menu.
- **Login page:** Improved background contrast for login screen.
- **Quality gates:** Lint, typecheck, and build all pass clean.

## Phase 19 — Bug fixes, performance, database hardening

- **Critical bug fixes:**
  - Fixed SSE notifications `cancel` handler (cleanup function was never called due to parameter mismatch).
  - Fixed contact page crash on malformed `openingHours` JSON (added try/catch).
  - Fixed origin check HTTP status codes (422/401 → 403 for invalid origins).
  - Fixed email notification blocking response (now fire-and-forget with `void`).
  - Fixed `hasPermission` crash on invalid role values (added defensive check).
  - Fixed admin role display (`replace` → `replaceAll` for multi-underscore roles).

- **Performance improvements:**
  - Added ISR `revalidate = 300` to all public pages (homepage, menu, gallery, about, contact, FAQ, terms, privacy).
  - Added image format optimization (`avif` + `webp`) and tuned `deviceSizes`/`imageSizes` in `next.config.ts`.
  - Replaced gallery preview direct DB call with cached `getPublishedGallery()` service.
  - Replaced `getDishBySlugCached` (loaded entire menu to find one dish) with direct `db.dish.findFirst` query.
  - Batched `updateSettings` upserts in `db.$transaction()` (11 round-trips → 1).
  - Added `select` to `fetchMenu` to avoid transferring full `description` text on list views.
  - Added `select` to `getSession` to avoid loading `passwordHash` into memory.
  - Added `select` to `fetchPublishedGallery` to avoid fetching unused columns.
  - Added `select` to `getSettingsCached`/`getSettingsFresh` to fetch only `key`+`value`.

- **Database hardening:**
  - Added try/catch with graceful fallbacks to `getDashboardStats`, `getRecentActivity`, `getRecentDishes`.
  - Added try/catch to `listGalleryAdmin`, `listCategoriesAdmin`.
  - Fixed `updateSettings` to use `db.$transaction()` for atomic batch upserts.

- **Minor fixes:**
  - Fixed dish price display in admin (raw `₹299` → `formatPrice(299)` for consistent formatting).
  - Added `type="button"` to error page button.
  - Removed unnecessary `Suspense` wrapper from admin messages page.
  - Updated deployment docs with specific database provisioning providers and steps.

## Phase 20 — Dead code removal, audit log hardening, final cleanup

- **Audit log hardening:** Wrapped `logAction` in try/catch — logging failures no longer crash mutations.
- **Removed dead CSRF module:** `lib/security/csrf.ts` + `hooks/use-csrf.ts` (generated tokens but never validated anywhere).
- **Removed dead hooks:** `use-media-query.ts`, `use-debounce.ts`, `use-toast.ts` (exported but never imported).
- **Removed dead UI components:** `select.tsx`, `form-field.tsx`, `pagination.tsx` (exported but never rendered).
- **Removed dead exports:** `createRequestId`, `formatDate`, `getCategoryAdmin`, `notFound` (response), `conflict`, `upload`, `pagination` (config).
- **Quality gates:** Lint, typecheck, and build all pass clean.

---

_Next up (manual): push to GitHub, provision prod/preview databases, import repo in Vercel, create production admin, replace placeholder images, run Lighthouse on the live domain._
