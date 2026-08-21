# HANDOFF DOCUMENT — Indian Café Full-Stack Website

**Current Date:** Phase 6 completion, moving into Phase 7 (TypeScript fixes) and Phase 8 (Admin dashboard).

## Project Status Summary

### What's Done (Phases 0–6)

**Phase 0 — AI Documentation (FULLY COMPLETE)**
- All 20 docs files created under `docs/`: BRAIN.md, MEMORY.md, PROJECT_OVERVIEW.md, MASTER_PLAN.md, ARCHITECTURE.md, DESIGN_SYSTEM.md, DATABASE_SCHEMA.md, API_SPECIFICATION.md, SECURITY.md, VALIDATION_RULES.md, TESTING.md, DEPLOYMENT.md, SEO.md, ACCESSIBILITY.md, PERFORMANCE.md, COMPONENT_RULES.md, CONTENT_GUIDE.md, ADMIN_GUIDE.md, TROUBLESHOOTING.md, CHANGELOG.md.
- These are the AI's permanent memory — read before any modification.

**Phase 1 — Foundation (FULLY COMPLETE)**
- Next.js 16.3.1 + TypeScript + Tailwind CSS v4 scaffolded.
- Tailwind 4 theme tokens in `app/globals.css`: color system (background/foreground/card/muted/border/primary/secondary/destructive/ring), typography (Fraunces display + Geist sans), spacing, radius, shadow, breakpoints.
- Config layer: `config/site.ts` (business info defaults), `config/navigation.ts`, `config/seo.ts`, `config/limits.ts`, `config/roles.ts` (permission matrix: SUPER_ADMIN > ADMIN > EDITOR).

**Phase 2 — Database (FULLY COMPLETE)**
- Prisma schema v7 with all models: Admin, Session, Category, Dish, GalleryImage, ContactMessage, ActivityLog, Setting.
- Migration `20260820204724_init` applied to local PostgreSQL `indian_cafe`.
- Seed data populated via `prisma db seed`: 6 categories (Starters→Beverages), 11 dishes (Paneer Tikka, Butter Chicken, Dal Makhani, etc.), 4 gallery images, all Setting rows.
- Client generated to `lib/generated/prisma` with `@prisma/adapter-pg` + `pg` driver.

**Phase 3 — Authentication (FULLY COMPLETE)**
- `lib/auth/passwords.ts`: Argon2id hash/verify with correct memoryCost/timeCost/parallelism.
- `lib/auth/session.ts`: Session creation with random 32-byte tokens, HttpOnly + Secure + SameSite=Lax cookies, sliding expiry (24h), lastUsedAt refresh, server-side invalidation on logout.
- `lib/auth/guards.ts`: `requireAdmin()` redirects unauthenticated to `/admin/login`; `requirePermission(role, permission)` checks via `config/roles.ts` matrix.
- `app/api/auth/login/route.ts`: POST with Zod-validated login schema, rate limiting (5/15min IP+account), generic "Invalid credentials" error (no account enumeration), session creation on success.
- `app/api/auth/logout/route.ts`: POST — deletes session server-side, returns `{ loggedOut: true }`.

**Phase 4 — API Routes (FULLY COMPLETE)**
- `/api/health` — GET status: `{ status: "healthy", timestamp }`.
- `/api/auth/login` — POST (see Phase 3).
- `/api/auth/logout` — POST (see Phase 3).
- `/api/contact` — POST with Zod-validated `contactMessageSchema`, rate limiting (3/10min IP), honeypot field (`website`), minimum form-time guard, IP hash storage, returns `{ received: true }` (spam bots get silent success to avoid tipping off).

**Phase 5 — UI Primitives + Layout (FULLY COMPLETE)**
- UI: `components/ui/button.tsx` (cva variants: default/secondary/outline/ghost/destructive, sizes: default/sm/lg/icon), `components/ui/input.tsx`, `components/ui/textarea.tsx`, `components/ui/label.tsx`, `components/ui/badge.tsx`, `components/ui/skeleton.tsx`, `components/ui/modal.tsx` (accessible dialog with focus trap + Escape key), `components/ui/select.tsx`, `components/ui/toast.tsx` (ToastProvider + useToast), `components/ui/form-field.tsx`.
- Layout: `components/layout/site-header.tsx` (client, mobile drawer, desktop nav, CTA buttons), `components/layout/site-footer.tsx` (receives `settings` prop, renders links, address, phone, hours, social, copyright).
- Root `app/layout.tsx`: Fraunces + Geist fonts, JSON-LD `Restaurant` schema, metadataBase, seo defaults.
- `(public)` layout `app/(public)/layout.tsx`: Fetches settings, renders `<SiteHeader />` + `<main>` + `<SiteFooter />`.
- Home page `app/(public)/page.tsx` → `Home` component.

**Phase 6 — Home Page Sections (FULLY COMPLETE)**
Created 6 home section components:
- `components/home/hero.tsx` — Fraunces display headline, CTA buttons, hero placeholder image with priority.
- `components/home/featured-dishes.tsx` — Shows 4 featured dishes from DB, category linking.
- `components/home/about-preview.tsx` — Split layout: image left, story text right with "Read our story" CTA.
- `components/home/menu-highlights.tsx` — Category grid linking to menu sections with dish count + first price.
- `components/home/gallery-preview.tsx` — 3-column link cards to gallery.
- `components/home/why-visit.tsx` — 3 feature cards (Superior Ingredients, Traditional Techniques, Warm Hospitality).

And the composition:
- `components/home/homepage.tsx` — Composes all sections in order: Hero → FeaturedDishes → AboutPreview → MenuHighlights → GalleryPreview → WhyVisit → CTA nav.
- `app/(public)/page.tsx` → `<Home />`.

### TypeScript Errors (KNOWN, to be fixed)

Many TS errors exist from the initial scaffold + Prisma v7 migration. Key categories:

1. **`lib/services/menu.ts`** — Prisma type mismatches (findFirst/findMany return types, transaction signatures). These stem from Prisma 7's new generator client API. Fix: review service signatures against generated types, adjust `include`/`select` usage.

2. **`app/layout.tsx` line 15** — `Type '"450"' is not assignable to type '"100" | "200" | ...'`. The `Fraunces` font weight values need to match Google Fonts exact weight strings. Fix: either remove the `weight` prop (use defaults) or use exact Google weight names: `weight: ["400", "500", "600", "700"]` — or simply omit and let Fraunces use its default subset.

3. **`app/layout.tsx` line 25** — `Type 'readonly ["indian café", ...]` is not assignable to `string | string[] | null | undefined`. The `seo.keywords` is `readonly` from `config/seo.ts`. Fix: spread with `[...seo.keywords]` when passing to metadata.

4. **`components/home/gallery-preview.tsx`** — `Cannot find name 'Link'`. The file imported `Link` from next but then the edit removed the import. Fix: add `import Link from "next/link"` back.

5. **`components/home/why-visit.tsx`** — `Property 'n' does not exist on type 'JSX.IntrinsicElements'`. The `<n>` element is an invalid HTML element. Fix: use `<span>{n}</span>` or just display text differently.

6. **`components/layout/site-footer.tsx`** — Date formatting `lowercase` option not valid for `Intl.DateTimeFormat`. Fix: use `"short"` or `"numeric"` instead of `"lowercase"`.

7. **`lib/validation/schemas.ts`** — `Property 'forms' does not exist on type`. The `limits.forms` reference in Zod schemas but `limits` is imported from `config/limits.ts` which has a `forms` object — the Zod schemas use `limits.forms.maxMessageLength` etc. but the type inference from `limits` doesn't expose `forms` because of how the config is typed. Fix: import specific limits or adjust schema to not reference `limits.forms` directly; use the numeric constants directly.

8. **`lib/logger.ts`** — Type mismatch: `LogEntry` requires `event` but the type definition may have changed. Fix: ensure `logger.info/warn/error` always pass an `event` string as first property.

### Remaining Work (Phases 7–13)

**Phase 7 — TypeScript Error Fixes (HIGH PRIORITY)**
- Fix all `tsc --noEmit` errors listed above.
- Verify build passes: `npm run build` succeeds.
- Run `npm run typecheck` clean.

**Phase 8 — Admin Dashboard (HIGH PRIORITY)**
- Create admin route group `app/admin/` with:
  - `app/admin/login/route.ts` — login form (use existing auth logic).
  - `app/admin/dashboard/page.tsx` — dashboard overview (stats cards: total dishes, active categories, featured items, new messages, recent activity).
  - `app/admin/categories/` — CRUD (list, create, edit, soft-delete, reorder).
  - `app/admin/dishes/` — CRUD with category selector, featured toggle, availability toggle, soft-delete + hard-delete confirmation, reorder drag-drop (use SortableJS or simple up/down buttons).
  - `app/admin/gallery/` — image upload (validate MIME/extension/size, generate safe filenames, store in `public/images/`), gallery manager.
  - `app/admin/messages/` — inbox with status workflow (NEW → READ → REPLIED → ARCHIVED), reply flag.
  - `app/admin/settings/` — edit business info (form with Zod validation, feed into `config/site.ts` + DB `Setting` model).
  - `app/admin/activity/` — read-only audit log list.
- All routes must use `requireAdmin()` + `requirePermission()` guards.
- Use server actions or route handlers with Zod validation + rate limiting.

**Phase 9 — Performance + Caching**
- ISR for public data: wrap `getMenu()` with `unstable_cache` (tag: "menu", revalidate: 300s). After admin dish/category changes, call `revalidateTag("menu", "max")` or `revalidatePath("/menu")`.
- Same for gallery: `unstable_cache` with tag "gallery".
- Image config in `next.config.ts`: proper `remotePatterns` or local patterns for placeholder images, `minimumCacheTTL`, `qualities`, `imageSizes` tuned for café use (not too aggressive).
- Font loading: use `next/font` with `display: swap` for Fraunces + Geist.
- Respect `prefers-reduced-motion` in all Framer Motion usage (already done in `Reveal` component).

**Phase 10 — Security Audit**
- Run the security checklist from `docs/SECURITY.md` §128:
  - Anonymous → `/admin/*` blocked ✅ (auth guard in place).
  - Session tampering / expiry → rejected ✅.
  - IDOR id swap → denied (need to verify every route checks permission).
  - Malicious upload → rejected (validate MIME + magic bytes + max size).
  - 1000 rapid contact requests → rate-limited ✅ (token bucket in `lib/rate-limit/limiter.ts`).
  - Login brute force → throttled ✅ (5/15min).
  - XSS payloads → rendered inert (no `dangerouslySetInnerHTML`).
  - SQLi payloads → parameterized (Prisma used throughout, no raw SQL).
  - Secrets in browser → none (all secrets server-only).
  - DB errors leaked → no (sanitized via `lib/api/response.ts`).
  - Mass assignment → stripped (Zod `.strict()` or manual field allow-listing).
  - Role escalation → denied (via `hasPermission`).
  - Expired session reuse → denied.
  - `.env` access → 404/gitignored.
  - GitHub secrets → ensure `.env.example` committed, `.env.local` gitignored, `AUTH_SECRET` rotated.

**Phase 11 — CI/CD**
- Create `.github/workflows/ci.yml`:
  - On push/PR: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
  - Optionally: `npm run test:e2e` if Playwright set up.
- Create `.github/workflows/security.yml`:
  - `npm audit` check, fail on high/critical.
  - `git-secret` scan if configured.
- Create `.github/workflows/deployment-check.yml`:
  - Verify migrations applied, env vars set, build succeeds before promoting preview → production.

**Phase 12 — Testing**
- Unit: `vitest` tests for `slugify`, `formatPrice`, `hasPermission`, validation schemas.
- Integration: DB operations (create dish with transaction, contact submission), auth flow, rate limiting behavior.
- Security: Unauthorized admin access, IDOR (try editing another's dish by ID swap), mass assignment (POST extra fields), XSS/SQLi payloads in dish name/description.
- E2E smoke with Playwright (optional): public user journey + admin login + create dish + logout.

**Phase 13 — Production Deployment**
- Vercel: connect GitHub repo, set env vars per environment (DATABASE_URL, AUTH_SECRET, APP_URL, EMAIL_API_KEY, STORAGE_*).
- Enable Vercel Postgres auto-backups (30-day retention), test restore quarterly.
- Separate environments: `development` (local Postgres), `preview` (Vercel automatic), `production` (live).
- Run final Lighthouse in Chrome (Performance / Accessibility / Best Practices / SEO targets ≥ 90).
- Run security audit with the checklist.
- Update `docs/CHANGELOG.md` with final phase completion.
- Freeze architecture: update `docs/BRAIN.md` and `docs/MEMORY.md` with final state.

## Immediate Next Steps (Tomorrow)

1. **Fix TypeScript errors** — Start with the most blocking ones:
   - Fix `app/layout.tsx` font weight/config and readonly keywords spreading.
   - Fix `components/home/gallery-preview.tsx` missing `Link` import.
   - Fix `components/home/why-visit.tsx` invalid `<n>` element.
   - Fix `lib/validation/schemas.ts` `limits.forms` type reference.
   - Fix `lib/logger.ts` LogEntry type mismatch.
   - Fix `lib/services/menu.ts` Prisma type signatures.

2. **Run `npm run build`** — Confirm it completes without errors.

3. **Begin Admin Dashboard** — Create `app/admin/login/route.tsx` using the existing login logic; then `app/admin/dashboard/page.tsx` with stats cards fetching from DB.

4. **Add remaining home sections if needed** — `components/home/reviews.tsx` and `components/home/location-cta.tsx` (optional for v1).

5. **Verify auth flows** — Manually test: open `/admin/login`, login with seed credentials (admin@spiceandsaffron.in / ChangeMe123!), navigate dashboard, create a dish, verify it appears on public menu, logout.

6. **Update CHANGELOG** — Log meaningful changes under "Phase 7 — TypeScript fixes" and "Phase 8 — Admin dashboard".

## Key Files to Reference

- `docs/BRAIN.md` — AI memory; read before every change.
- `docs/MEMORY.md` — Stable project facts.
- `docs/MASTER_PLAN.md` — Phase roadmap.
- `prisma/schema.prisma` — DB schema (source of truth for migrations).
- `prisma/seed.ts` — Dev seed data.
- `config/site.ts` — Business config (also feeds public footer).
- `lib/auth/passwords.ts` + `lib/auth/session.ts` — Auth core.
- `lib/services/menu.ts` + `lib/services/settings.ts` — Business logic.
- `components/ui/` — All UI primitives.
- `app/(public)/` — Public website.
- `app/admin/` — Admin dashboard (in progress).
- `.env.example` — Documented env placeholders (never commit real secrets).
- `package.json` — Scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `db:seed`, `create-admin`, `test`.

## AI Development Rules (from BRAIN.md)

Always follow the 25 rules listed in `docs/BRAIN.md` §131, especially:
- Read `docs/BRAIN.md` + `docs/MEMORY.md` + `docs/PROJECT_OVERVIEW.md` + `docs/ARCHITECTURE.md` before modifying.
- Never expose secrets to the browser.
- Never trust client-side validation alone.
- Validate all server input with Zod.
- Protect every private operation with authentication and authorization.
- Use meaningful naming; no `x1`, `temp2`, `handleThingFinalNew`.
- Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` before considering any feature done.
- Update `docs/CHANGELOG.md` for meaningful changes.
- Never claim something is secure without testing it.

---

**End of handoff document.** 

Continue from Phase 7 (TypeScript fixes) per the todo list. The next AI session should start by reading `docs/BRAIN.md`, then fix `tsc --noEmit` errors, then proceed to the admin dashboard.